import { createRng } from "@shared/rng";
import { TRAIN_LIVES } from "@shared/rules";
import type { GameConfig, RoundResult, Sentence } from "@shared/types";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { PixelButton } from "../../components/ui/PixelButton";
import { PixelIcon } from "../../components/ui/PixelIcon";
import { playSfx } from "../../lib/sfx";
import { useSettings } from "../../store/settings";
import { isImeKey, Stage } from "../common/Stage";
import { SideButton } from "../ghost-race/Round";
import { TrainEngine } from "./engine";

interface Props {
  config: GameConfig & { sentences: Sentence[] };
  unitIdx: number;
  unitTitle: string;
  onFinish: (
    result: RoundResult,
    events: TrainEngine["events"],
    words: GameConfig["words"],
  ) => Promise<void> | void;
  onExit: () => void;
}

type Overlay = "countdown" | "none" | "paused" | "ime" | "finishing";

const DEPART_MS = 1300;

function Loco() {
  return (
    <svg width="112" height="91" viewBox="0 0 16 13" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="2" y="0" width="3" height="3" fill="#333c57" />
      <rect x="1" y="0" width="5" height="1" fill="#0d0e18" />
      <rect x="0" y="3" width="13" height="6" fill="#b13e53" />
      <rect x="9" y="1" width="6" height="8" fill="#5d275d" />
      <rect x="10" y="2" width="4" height="3" fill="#73eff7" />
      <rect x="0" y="5" width="9" height="1" fill="#ffcd75" />
      <rect x="0" y="9" width="16" height="1" fill="#0d0e18" />
      <rect x="1" y="10" width="3" height="3" fill="#0d0e18" />
      <rect x="6" y="10" width="3" height="3" fill="#0d0e18" />
      <rect x="11" y="10" width="3" height="3" fill="#0d0e18" />
    </svg>
  );
}

export function Round({ config, unitIdx, unitTitle, onFinish, onExit }: Props) {
  const [engine] = useState(() => new TrainEngine(config));
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
    (window as unknown as { __sentenceExpress?: TrainEngine }).__sentenceExpress = engine;
  }
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [overlay, setOverlay] = useState<Overlay>("countdown");
  const [count, setCount] = useState(3);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<{ text: string; tone: "good" | "bad" | "info" } | null>(null);
  const sound = useSettings((s) => s.sound);
  const setSettings = useSettings((s) => s.set);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const finishing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyword = useMemo(() => new Map(config.words.map((w) => [w.id, w])), [config.words]);

  useEffect(
    () =>
      engine.subscribe((n) => {
        const play = (k: Parameters<typeof playSfx>[0]) => soundRef.current && playSfx(k);
        if (n.kind === "place") play("key");
        else if (n.kind === "reject") {
          play("wrong");
          setShake((s) => s + 1);
        } else if (n.kind === "solved") {
          play("hit");
          setMsg({ text: "ĐÚNG RỒI! Tàu chạy tới ga tiếp theo", tone: "good" });
          setTimeout(() => {
            engine.next();
            setMsg(null);
            rerender();
          }, DEPART_MS);
        } else if (n.kind === "wrong") {
          play("miss");
          setShake((s) => s + 1);
          setMsg({ text: "Toa đỏ sai chỗ — dỡ ra xếp lại · mất 1 than", tone: "bad" });
        } else if (n.kind === "hint") {
          setMsg({
            text: "Gợi ý: đã xếp đúng toa tiếp theo (câu này tính nửa điểm)",
            tone: "info",
          });
        } else if (n.kind === "unplace") setMsg(null);
        else if (n.kind === "end") {
          const won = engine.lives > 0;
          play(won ? "win" : "lose");
          if (!finishing.current) {
            finishing.current = true;
            setOverlay("finishing");
            setTimeout(() => void onFinish(engine.result(), engine.events, config.words), 1200);
          }
        }
        rerender();
      }),
    [engine, onFinish, config.words],
  );

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
      engine.pause();
      setOverlay(kind);
    },
    [engine],
  );
  const resume = useCallback(() => {
    engine.resume();
    setOverlay("none");
    inputRef.current?.focus();
  }, [engine]);

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
      if (e.key === "Enter") {
        e.preventDefault();
        engine.enter();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        engine.erase();
      } else if (e.key.length === 1) {
        e.preventDefault();
        engine.type(e.key);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [engine, overlay, pause, resume]);

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

  const s = engine.current;
  const { words, end } = engine.parts;
  const key = s ? keyword.get(s.wordId) : undefined;
  // a stable scatter of the crates in the yard for this sentence
  const jitter = useMemo(() => {
    const rng = createRng((s?.id ?? 1) * 7919);
    return engine.crates.map(() => Math.round(rng() * 34));
  }, [s?.id, engine.crates]);
  const typedHint = engine.buffer;

  return (
    <Stage className="bg-sky">
      <div className="h-full w-full" onPointerDown={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          aria-label="Gõ từ để chất lên toa"
          className="absolute h-px w-px opacity-0"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value=""
          onChange={() => {}}
          onCompositionStart={() => engine.status === "playing" && pause("ime")}
        />
        <svg
          aria-hidden="true"
          className="absolute top-[130px] left-0"
          width="1280"
          height="112"
          viewBox="0 0 160 14"
          shapeRendering="crispEdges"
        >
          <path
            d="M0 14V8h10V5h8V2h6v3h10v4h12V6h10V3h8v4h14V4h8v3h10v3h12V5h10V1h6v4h10v3h10v6z"
            fill="#38b764"
          />
          <path d="M0 14v-3h20V9h14v2h30V8h16v3h26V9h18v2h36v3z" fill="#2a9d8f" />
        </svg>
        <div aria-hidden="true" className="absolute inset-x-0 top-[240px] h-[150px] bg-lime" />

        {/* HUD */}
        <div className="absolute top-4 right-5 left-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SideButton label="Tạm dừng" onClick={() => pause("paused")}>
              <PixelIcon name="pause" size={14} color="#f4f4f4" />
            </SideButton>
            <SideButton
              label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
              pressed={sound}
              onClick={() => setSettings({ sound: !sound })}
            >
              <PixelIcon name="note" size={14} color={sound ? "#12302b" : "#94b0c2"} />
            </SideButton>
            <div className="hb-hud flex flex-col px-3 py-0.5">
              <span className="font-px t-sm text-gold">SENTENCE EXPRESS</span>
              <span className="t-sm text-mist">
                Mốc {unitIdx} · {unitTitle}
              </span>
            </div>
          </div>
          <div className="hb-hud flex items-center gap-2 px-3 py-1.5">
            <span className="font-px t-sm mr-1">
              GA {Math.min(engine.idx + 1, engine.sentences.length)}/{engine.sentences.length}
            </span>
            {engine.sentences.map((x, i) => (
              <span
                key={x.id}
                className={`h-3.5 w-3.5 shadow-[0_0_0_2px_#0d0e18] ${
                  i < engine.solvedCount ? "bg-green" : i === engine.idx ? "bg-gold" : "bg-steel"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="hb-hud font-px t-md px-3 py-1 text-gold">
              {engine.score.toLocaleString("vi-VN")}
            </span>
            <span
              className="hb-hud flex items-center gap-1.5 px-3 py-2"
              role="img"
              aria-label={`Còn ${engine.lives} cục than`}
            >
              <span className="font-px t-sm mr-1 text-mist">THAN</span>
              {Array.from({ length: TRAIN_LIVES }, (_, i) => (
                <svg
                  key={i}
                  width="22"
                  height="18"
                  viewBox="0 0 6 5"
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                  opacity={i < engine.lives ? 1 : 0.25}
                >
                  <rect x="1" y="0" width="4" height="1" fill="#566c86" />
                  <rect x="0" y="1" width="6" height="3" fill="#566c86" />
                  <rect x="1" y="4" width="4" height="1" fill="#566c86" />
                  <rect x="1" y="1" width="2" height="1" fill="#c5d6e3" />
                </svg>
              ))}
            </span>
          </div>
        </div>

        {/* station sign */}
        <div className="absolute top-[80px] left-1/2 flex -translate-x-1/2 flex-col items-center">
          <div
            className="flex max-w-[1000px] flex-col items-center gap-1 bg-snow px-5 py-2 text-ink shadow-[0_0_0_4px_#0d0e18,6px_8px_0_0_#0d0e18]"
            data-testid="train-sign"
          >
            <span className="font-px t-sm text-slate">CÂU CẦN XẾP</span>
            <span key={s?.id} className="t-md t-bold anim-pop text-center">
              {s?.vi}
            </span>
            {key && (
              <span className="t-sm text-teal">
                từ khoá: <b>{key.lemma}</b> = {key.meaningVi}
              </span>
            )}
          </div>
          <div aria-hidden="true" className="h-5 w-2 bg-plum" />
        </div>

        {/* train */}
        <div
          className="absolute top-[282px] left-6 flex items-end"
          style={{
            transform: engine.departing ? "translateX(1400px)" : "none",
            transition: engine.departing ? `transform ${DEPART_MS - 200}ms steps(10)` : "none",
          }}
        >
          <Loco />
          {words.map((_, slot) => {
            const id = engine.placed[slot];
            const text = id === undefined ? "" : (engine.crate(id)?.text ?? "");
            const bad = engine.wrongSlots.has(slot);
            const good = engine.departing;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => engine.unplace(slot)}
                aria-label={text ? `Toa ${slot + 1}: ${text}, bấm để dỡ` : `Toa ${slot + 1} trống`}
                className={`relative ml-1.5 flex h-[60px] items-center justify-center px-2 ${
                  good ? "bg-green" : bad ? "bg-berry-dk" : "bg-teal"
                } shadow-[0_0_0_3px_#0d0e18,inset_0_-6px_0_rgb(0_0_0/0.3)]`}
                style={{ minWidth: Math.max(64, 22 + Math.max(text.length, 3) * 11) }}
              >
                {text ? (
                  <span className="font-px t-sm bg-gold px-1.5 py-1 text-[#3a1a18] shadow-[0_0_0_2px_#0d0e18]">
                    {text}
                  </span>
                ) : (
                  <span className="font-px t-sm text-ice/60">?</span>
                )}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-3 left-2 h-3.5 w-3.5 bg-abyss"
                />
                <span
                  aria-hidden="true"
                  className="absolute right-2 -bottom-3 h-3.5 w-3.5 bg-abyss"
                />
              </button>
            );
          })}
          {end && <span className="font-px t-lg ml-2 self-center text-ink">{end}</span>}
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 top-[356px] h-1 bg-mist" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[360px] h-3 bg-[repeating-linear-gradient(90deg,#5d275d_0_10px,#333c57_10px_28px)]"
        />

        {/* yard */}
        <section
          aria-label="Bãi hàng: các từ bị xáo trộn"
          key={shake}
          className={`absolute top-[410px] right-[100px] left-[100px] h-[170px] bg-slate shadow-[0_0_0_4px_#0d0e18,inset_0_0_0_6px_#333c57] ${shake ? "anim-shake" : ""}`}
        >
          <span className="font-px t-sm absolute -top-4 left-4 bg-gold px-2 py-0.5 text-[#3a1a18] shadow-[0_0_0_3px_#0d0e18]">
            BÃI HÀNG
          </span>
          <div className="flex h-full flex-wrap content-center items-start justify-center gap-x-5 gap-y-1 px-6 pt-2">
            {engine.crates.map((c, i) => {
              const used = engine.isPlaced(c.id);
              const match =
                !used &&
                typedHint &&
                c.text
                  .toLowerCase()
                  .replace(/[^a-z'-]/g, "")
                  .startsWith(typedHint);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={used}
                  onClick={() => engine.place(c.id)}
                  data-testid="crate"
                  className={`font-px t-md px-3 pt-0.5 pb-1.5 ${
                    used
                      ? "text-steel shadow-[inset_0_0_0_3px_#333c57]"
                      : "bg-gold text-[#3a1a18] shadow-[0_0_0_3px_#0d0e18,inset_-3px_-4px_0_rgb(0_0_0/0.2)] hover:-translate-y-0.5"
                  }`}
                  style={{
                    marginTop: jitter[i] ?? 0,
                    boxShadow: match
                      ? "0 0 0 3px #73eff7, inset -3px -4px 0 rgb(0 0 0 / 0.2)"
                      : undefined,
                  }}
                >
                  {c.text}
                </button>
              );
            })}
          </div>
        </section>

        <div
          aria-live="polite"
          className={`t-md absolute inset-x-0 top-[592px] text-center ${
            msg?.tone === "bad" ? "text-berry-dk" : msg?.tone === "good" ? "text-ink" : "text-ink"
          }`}
        >
          {msg?.text ??
            (engine.full
              ? "Đủ toa rồi! Nhấn Enter hoặc XUẤT PHÁT"
              : "Bấm hoặc gõ từ theo đúng thứ tự để chất lên toa")}
        </div>

        <div className="absolute inset-x-0 top-[640px] flex items-center justify-center gap-3">
          <PixelButton tone="grey" size="sm" onClick={() => engine.undo()}>
            ◂ Dỡ toa
          </PixelButton>
          <PixelButton tone="red" size="sm" onClick={() => engine.hint()}>
            Gợi ý
          </PixelButton>
          <div className="hb-inset font-px t-md flex h-[52px] w-[300px] items-center px-3">
            {typedHint ? (
              <>
                <span className="text-gold">{typedHint}</span>
                <span className="anim-pulse ml-0.5 inline-block h-6 w-3 bg-ice" />
              </>
            ) : (
              <span className="t-sm text-slate">gõ từ để chất hàng…</span>
            )}
          </div>
          <PixelButton
            tone={engine.full ? "green" : "grey"}
            size="sm"
            onClick={() => engine.submit()}
          >
            Xuất phát ▸
          </PixelButton>
        </div>

        {overlay === "countdown" && count > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-void/60">
            <div key={count} className="font-px t-gold text-[144px] leading-[144px]">
              {count}
            </div>
            <div className="hb-panel hb-lift flex max-w-[700px] flex-col items-center gap-1 px-5 py-3 text-center">
              <p className="t-md">Xếp các từ thành câu đúng nghĩa trên bảng ga để tàu chạy.</p>
              <p className="t-sm text-haze">
                Bấm vào thùng hàng hoặc gõ từ để chất lên toa, Backspace để dỡ, Enter để xuất phát.
              </p>
              <p className="t-sm text-mist">Sai thứ tự mất 1 cục than. Hết than là dừng tàu.</p>
            </div>
          </div>
        )}

        {overlay === "finishing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/70">
            <div className="t-gold text-[72px] leading-[80px]">
              {engine.lives > 0 ? "TỚI GA CUỐI!" : "HẾT THAN!"}
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
          <p>Tàu đang dừng. Nhấn Esc để tiếp tục.</p>
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
          <p>Bộ gõ tiếng Việt biến phím bạn gõ thành chữ có dấu nên game không nhận được.</p>
        </Modal>
      </div>
    </Stage>
  );
}
