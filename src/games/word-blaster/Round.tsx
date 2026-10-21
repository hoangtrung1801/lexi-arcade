import { MAX_LIVES } from "@shared/rules";
import type { GameConfig, RoundResult } from "@shared/types";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { HeartRow } from "../../components/ui/HeartRow";
import { Modal } from "../../components/ui/Modal";
import { PixelBar } from "../../components/ui/PixelBar";
import { PixelButton } from "../../components/ui/PixelButton";
import { PixelIcon } from "../../components/ui/PixelIcon";
import { playSfx, speak } from "../../lib/sfx";
import { useSettings } from "../../store/settings";
import { createGameBus } from "./bus";
import { FIELD_H, FIELD_W, WordBlasterEngine } from "./logic/engine";
import { GameHost } from "./phaser/GameHost";

interface Props {
  config: GameConfig;
  unitIdx: number;
  unitCount: number;
  setName: string;
  onFinish: (
    result: RoundResult,
    events: WordBlasterEngine["events"],
    words: GameConfig["words"],
  ) => Promise<void> | void;
  onExit: () => void;
}

type Overlay = "countdown" | "none" | "paused" | "ime" | "finishing";

function isImeKey(e: KeyboardEvent) {
  if (e.isComposing || e.key === "Process" || e.keyCode === 229) return true;
  // composed result such as "â" or "ơ" arrives as a single non-ASCII letter
  return e.key.length === 1 && /\p{L}/u.test(e.key) && !/^[a-z]$/i.test(e.key);
}

/** Largest 16:9 box that fits the window, in CSS px (explicit sizes behave the same in every browser). */
function useFieldSize() {
  const measure = () => {
    const k = Math.min(window.innerWidth / FIELD_W, window.innerHeight / FIELD_H);
    return { width: Math.floor(FIELD_W * k), height: Math.floor(FIELD_H * k) };
  };
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const on = () => setSize(measure());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}

export function Round({ config, unitIdx, unitCount, setName, onFinish, onExit }: Props) {
  const [engine] = useState(() => new WordBlasterEngine(config));
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
    (window as unknown as { __wordBlaster?: WordBlasterEngine }).__wordBlaster = engine;
  }
  const [bus] = useState(createGameBus);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [overlay, setOverlay] = useState<Overlay>("countdown");
  const [count, setCount] = useState(3);
  const [banner, setBanner] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showMeaning = useSettings((s) => s.showMeaning);
  const sound = useSettings((s) => s.sound);
  const setSettings = useSettings((s) => s.set);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const finishing = useRef(false);

  // mirror engine notices into React + sound
  useEffect(
    () =>
      engine.subscribe((n) => {
        const play = (k: Parameters<typeof playSfx>[0]) => soundRef.current && playSfx(k);
        if (n.kind === "key") play("key");
        else if (n.kind === "hit") play("hit");
        else if (n.kind === "wrong") play("wrong");
        else if (n.kind === "miss") play("miss");
        else if (n.kind === "end") {
          play(n.status === "won" ? "win" : "lose");
          if (!finishing.current) {
            finishing.current = true;
            setBanner(n.status === "won" ? "HOÀN THÀNH!" : "HẾT MẠNG!");
            setOverlay("finishing");
            setTimeout(() => {
              void onFinish(engine.result(), engine.events, engine.words);
            }, 1100);
          }
        }
        rerender();
      }),
    [engine, onFinish],
  );

  // 3-2-1 countdown, then start
  useEffect(() => {
    if (overlay !== "countdown") return;
    if (count === 0) {
      engine.start();
      setOverlay("none");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [overlay, count, engine]);

  const pause = useCallback(
    (kind: "paused" | "ime") => {
      if (engine.status === "playing") engine.pause();
      setOverlay(kind);
    },
    [engine],
  );
  const resume = useCallback(() => {
    if (engine.status === "paused") engine.resume();
    setOverlay("none");
    inputRef.current?.focus();
  }, [engine]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (engine.status === "playing") pause("paused");
        else if (overlay === "paused") resume();
        return;
      }
      if (engine.status !== "playing") return;
      if (isImeKey(e)) {
        pause("ime");
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1) {
        e.preventDefault();
        engine.type(e.key);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [engine, overlay, pause, resume]);

  // auto-pause when the tab loses focus
  useEffect(() => {
    const onHide = () => {
      if (engine.status === "playing") pause("paused");
    };
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [engine, pause]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const target = engine.target;
  const field = useFieldSize();
  const speakWord = () => {
    const w = target?.word ?? [...engine.active].sort((a, b) => b.y - a.y)[0]?.word;
    if (w) speak(w.id, w.lemma);
  };

  return (
    <div
      className="relative shrink-0 overflow-hidden bg-void"
      style={field}
      onPointerDown={() => inputRef.current?.focus()}
    >
      <GameHost engine={engine} bus={bus} showMeaning={showMeaning} />

      <input
        ref={inputRef}
        aria-label="Gõ từ để bắn"
        className="absolute h-px w-px opacity-0"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value=""
        onChange={() => {}}
        onCompositionStart={() => engine.status === "playing" && pause("ime")}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute top-[2.5%] right-[2%] left-[2%] flex items-start justify-between">
        <div className="hb-hud flex items-center gap-2 px-2">
          <PixelIcon name="star" size={22} />
          <span className="font-px t-lg t-shadow min-w-[4ch] text-gold">
            {engine.score.toLocaleString("vi-VN")}
          </span>
        </div>
        <div className="hb-hud flex items-center gap-3 px-3 py-0.5">
          <span className="t-sm t-bold uppercase">
            Mốc {unitIdx}/{unitCount}
          </span>
          <PixelBar
            value={engine.hitCount}
            max={Math.max(1, engine.total)}
            label="Tiến độ mốc"
            className="w-44"
            height={8}
          />
          <span className="t-sm text-mist">
            <span className="text-snow">{engine.hitCount}</span>/{engine.total} từ
          </span>
        </div>
        <div className="hb-hud px-2 py-1">
          <HeartRow lives={engine.lives} max={MAX_LIVES} />
        </div>
      </div>

      <div className="absolute top-[17%] right-[2%] flex flex-col gap-2">
        <SideButton
          label="Thoát"
          onClick={() => {
            if (engine.status === "playing") engine.pause();
            setOverlay("paused");
          }}
        >
          <PixelIcon name="close" size={14} color="#f4f4f4" />
        </SideButton>
        <SideButton label="Tạm dừng" onClick={() => pause("paused")}>
          <PixelIcon name="pause" size={14} color="#f4f4f4" />
        </SideButton>
        <SideButton label="Phát âm từ" onClick={speakWord}>
          <PixelIcon name="speaker" size={18} color="#f4f4f4" />
        </SideButton>
        <SideButton
          label={showMeaning ? "Ẩn nghĩa tiếng Việt" : "Hiện nghĩa tiếng Việt"}
          pressed={showMeaning}
          onClick={() => setSettings({ showMeaning: !showMeaning })}
        >
          <span className="font-px t-sm">VI</span>
        </SideButton>
        <SideButton
          label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
          pressed={sound}
          onClick={() => setSettings({ sound: !sound })}
        >
          <PixelIcon name="note" size={14} color={sound ? "#12302b" : "#94b0c2"} />
        </SideButton>
      </div>

      <div className="pointer-events-none absolute right-0 bottom-[1.5%] left-0 flex items-center justify-center gap-3">
        <span className="hb-hud t-sm px-2 py-1 text-mist uppercase">{setName}</span>
        <div
          className="hb-inset font-px t-md flex h-[52px] w-[320px] items-center px-3"
          aria-live="off"
        >
          {target ? (
            <>
              <span className="text-gold [text-shadow:0_2px_0_#7a3a12]">
                {target.word.lemma.slice(0, target.typed)}
              </span>
              <span className="text-slate">{target.word.lemma.slice(target.typed)}</span>
              <span className="anim-pulse ml-0.5 inline-block h-6 w-3 bg-ice" />
            </>
          ) : (
            <span className="t-sm text-slate">gõ chữ cái đầu của một từ…</span>
          )}
        </div>
        <span
          className={`hb-hud flex items-center gap-1 px-2 py-1 ${engine.combo >= 5 ? "hb-glow" : ""}`}
        >
          <PixelIcon name="flame" size={18} dim={engine.combo < 2} />
          <span className={`font-px t-md ${engine.combo >= 2 ? "text-orange" : "text-slate"}`}>
            x{engine.combo}
          </span>
        </span>
      </div>

      {/* overlays */}
      {overlay === "countdown" && count > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-void/60">
          <div key={count} className="font-px t-gold text-[144px] leading-[144px]">
            {count}
          </div>
          <div className="hb-panel hb-lift flex max-w-[640px] flex-col items-center gap-1 px-5 py-3 text-center">
            <p className="t-md">Gõ chữ cái đầu để khoá mục tiêu, gõ hết từ để bắn hạ.</p>
            <p className="t-sm text-mist">
              Hãy tắt bộ gõ tiếng Việt (Unikey/EVKey) trước khi chơi.
            </p>
          </div>
        </div>
      )}

      {overlay === "finishing" && banner && (
        <div className="absolute inset-0 flex items-center justify-center bg-void/70">
          <div className="t-gold text-[72px] leading-[80px]">{banner}</div>
        </div>
      )}

      <Modal
        open={overlay === "paused"}
        title="TẠM DỪNG"
        onClose={resume}
        actions={
          <>
            <PixelButton tone="grey" size="sm" onClick={onExit}>
              THOÁT RA BẢN ĐỒ
            </PixelButton>
            <PixelButton tone="gold" size="sm" onClick={resume}>
              TIẾP TỤC
            </PixelButton>
          </>
        }
      >
        <p>Ván chơi đang dừng. Nhấn Esc để tiếp tục.</p>
        <p className="mt-2 text-mist">Thoát giữa chừng sẽ không tính điểm.</p>
      </Modal>

      <Modal
        open={overlay === "ime"}
        title="HÃY TẮT BỘ GÕ TIẾNG VIỆT"
        actions={
          <PixelButton tone="gold" size="sm" onClick={resume}>
            ĐÃ TẮT, TIẾP TỤC
          </PixelButton>
        }
      >
        <p>
          Bộ gõ tiếng Việt (Unikey, EVKey, Telex/VNI…) biến phím bạn gõ thành chữ có dấu nên game
          không nhận được.
        </p>
        <ul className="mt-3 list-disc pl-6 text-mist">
          <li>Windows: nhấn Ctrl+Shift hoặc đổi biểu tượng V → E ở thanh tác vụ.</li>
          <li>macOS: đổi nguồn nhập sang “ABC” hoặc “U.S.” (Ctrl+Space).</li>
        </ul>
      </Modal>
    </div>
  );
}

function SideButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`group flex h-[52px] w-[52px] items-center justify-center pb-1 ${
        pressed === undefined
          ? "hb-btn-grey"
          : pressed
            ? "hb-btn-green text-[#12302b]"
            : "hb-btn-dark text-mist"
      }`}
    >
      <span className="relative group-active:top-1">{children}</span>
    </button>
  );
}
