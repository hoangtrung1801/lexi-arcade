import { MAX_LIVES } from "@shared/rules";
import type { GameConfig, RoundResult } from "@shared/types";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { HeartRow } from "../../components/ui/HeartRow";
import { Modal } from "../../components/ui/Modal";
import { PixelButton } from "../../components/ui/PixelButton";
import { PixelIcon } from "../../components/ui/PixelIcon";
import { playSfx, speak } from "../../lib/sfx";
import { useSettings } from "../../store/settings";
import { createGameBus } from "./bus";
import { WordBlasterEngine } from "./logic/engine";
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
  const speakWord = () => {
    const w = target?.word ?? [...engine.active].sort((a, b) => b.y - a.y)[0]?.word;
    if (w) speak(w.id, w.lemma);
  };

  return (
    <div
      className="relative overflow-hidden bg-ink"
      style={{ width: "min(100vw, calc(100vh * 960 / 540))", aspectRatio: "960 / 540" }}
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
      <div className="pointer-events-none absolute top-[3%] right-[2.5%] left-[2.5%] flex items-center justify-between">
        <div className="font-px flex items-center gap-2.5 bg-abyss/80 px-3.5 py-2.5 text-sm text-gold px-inset">
          <PixelIcon name="star" size={18} color="#ffcd75" />
          {engine.score.toLocaleString("vi-VN")}
        </div>
        <div className="flex items-center gap-3.5 bg-abyss/80 px-4 py-1.5 px-inset">
          <span className="font-vi text-[20px]">
            MỐC {unitIdx}/{unitCount}
          </span>
          <div
            className="h-3 w-40 bg-steel px-inset"
            role="progressbar"
            aria-valuenow={engine.hitCount}
            aria-valuemax={engine.total}
            aria-label="Tiến độ mốc"
          >
            <div
              className="h-full"
              style={{
                width: `${(engine.hitCount / Math.max(1, engine.total)) * 100}%`,
                background: "repeating-linear-gradient(90deg,#a7f070 0 8px,transparent 8px 10px)",
              }}
            />
          </div>
          <span className="text-[22px] text-mist">
            {engine.hitCount}/{engine.total} từ
          </span>
        </div>
        <div className="bg-abyss/80 px-3 py-2.5 px-inset">
          <HeartRow lives={engine.lives} max={MAX_LIVES} />
        </div>
      </div>

      <div className="absolute top-[18%] right-[2.5%] flex flex-col gap-3.5">
        <button
          type="button"
          aria-label="Thoát"
          className="px-btn flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-steel"
          onClick={() => {
            if (engine.status === "playing") engine.pause();
            setOverlay("paused");
          }}
        >
          <PixelIcon name="close" size={16} color="#f4f4f4" />
        </button>
        <button
          type="button"
          aria-label="Tạm dừng"
          className="px-btn flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-steel"
          onClick={() => pause("paused")}
        >
          <PixelIcon name="pause" size={16} color="#f4f4f4" />
        </button>
        <button
          type="button"
          aria-label="Phát âm từ"
          className="px-btn flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-steel"
          onClick={speakWord}
        >
          <PixelIcon name="speaker" size={20} color="#f4f4f4" />
        </button>
        <button
          type="button"
          aria-label={showMeaning ? "Ẩn nghĩa tiếng Việt" : "Hiện nghĩa tiếng Việt"}
          aria-pressed={showMeaning}
          className={`px-btn font-px flex h-11 w-11 cursor-pointer items-center justify-center border-0 text-[10px] ${showMeaning ? "bg-lime text-ink" : "bg-steel text-mist"}`}
          onClick={() => setSettings({ showMeaning: !showMeaning })}
        >
          VI
        </button>
        <button
          type="button"
          aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
          aria-pressed={sound}
          className={`px-btn font-px flex h-11 w-11 cursor-pointer items-center justify-center border-0 text-[10px] ${sound ? "bg-lime text-ink" : "bg-steel text-mist"}`}
          onClick={() => setSettings({ sound: !sound })}
        >
          ♪
        </button>
      </div>

      <div className="absolute right-0 bottom-[1.2%] left-0 flex items-center justify-center gap-4">
        <span className="font-vi bg-abyss/80 px-3 py-1.5 text-[20px] text-mist px-inset">
          {setName}
        </span>
        <div
          className="font-px px-inset flex h-11 w-[300px] items-center bg-abyss px-3.5 text-base text-gold"
          aria-live="off"
        >
          {target ? (
            <>
              <span>{target.word.lemma.slice(0, target.typed)}</span>
              <span className="animate-pulse text-mist">_</span>
            </>
          ) : (
            <span className="text-slate">gõ từ...</span>
          )}
        </div>
        <span className="font-px bg-abyss/80 px-3 py-2.5 text-[10px] text-lime px-inset">
          COMBO x{engine.combo}
        </span>
      </div>

      {/* overlays */}
      {overlay === "countdown" && count > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-abyss/60">
          <div className="font-px text-[96px] text-gold [text-shadow:6px_6px_0_var(--color-abyss)]">
            {count}
          </div>
          <p className="text-3xl text-snow">
            Gõ chữ cái đầu để khoá mục tiêu, gõ hết từ để bắn hạ.
          </p>
          <p className="text-2xl text-mist">
            Hãy tắt bộ gõ tiếng Việt (Unikey/EVKey) trước khi chơi.
          </p>
        </div>
      )}

      {overlay === "finishing" && banner && (
        <div className="absolute inset-0 flex items-center justify-center bg-abyss/70">
          <div className="font-vi text-[72px] text-gold [text-shadow:6px_6px_0_var(--color-abyss)]">
            {banner}
          </div>
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
