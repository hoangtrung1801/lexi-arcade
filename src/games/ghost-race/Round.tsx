import { ghostAt } from "@shared/race";
import type { GameConfig, Ghost, RoundResult } from "@shared/types";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { PixelButton } from "../../components/ui/PixelButton";
import { PixelIcon } from "../../components/ui/PixelIcon";
import { playSfx, speak } from "../../lib/sfx";
import { useSettings } from "../../store/settings";
import { isImeKey, Stage } from "../common/Stage";
import { RaceEngine } from "./engine";

interface Props {
  config: GameConfig & { ghosts: Ghost[] };
  unitIdx: number;
  unitTitle: string;
  onFinish: (
    result: RoundResult,
    events: RaceEngine["events"],
    words: GameConfig["words"],
  ) => Promise<void> | void;
  onExit: () => void;
}

type Overlay = "countdown" | "none" | "paused" | "ime" | "finishing";

const TRACK_X = 170;
const TRACK_W = 1000;

interface Lane {
  key: string;
  tag: string;
  sub: string;
  body: string;
  tagColor: string;
  ghost: boolean;
  at: (t: number) => number;
  /** when this car crosses the line, if known */
  finishMs: number | null;
}

export function formatTime(ms: number) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
}

export function Car({ body, className }: { body: string; className?: string }) {
  return (
    <svg
      className={className}
      width="88"
      height="44"
      viewBox="0 0 16 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="3" y="0" width="8" height="1" fill={body} />
      <rect x="2" y="1" width="10" height="2" fill={body} />
      <rect x="4" y="1" width="3" height="2" fill="#73eff7" />
      <rect x="8" y="1" width="3" height="2" fill="#73eff7" />
      <rect x="0" y="3" width="16" height="3" fill={body} />
      <rect x="14" y="3" width="2" height="1" fill="#ffcd75" />
      <rect x="0" y="3" width="1" height="2" fill="#b13e53" />
      <rect x="0" y="6" width="16" height="1" fill="#0d0e18" opacity=".35" />
      <rect x="2" y="5" width="3" height="3" fill="#0d0e18" />
      <rect x="11" y="5" width="3" height="3" fill="#0d0e18" />
      <rect x="3" y="6" width="1" height="1" fill="#94b0c2" />
      <rect x="12" y="6" width="1" height="1" fill="#94b0c2" />
    </svg>
  );
}

export function Round({ config, unitIdx, unitTitle, onFinish, onExit }: Props) {
  const [engine] = useState(() => new RaceEngine(config));
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
    (window as unknown as { __ghostRace?: RaceEngine }).__ghostRace = engine;
  }
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [overlay, setOverlay] = useState<Overlay>("countdown");
  const [count, setCount] = useState(3);
  const [shake, setShake] = useState(0);
  const sound = useSettings((s) => s.sound);
  const setSettings = useSettings((s) => s.set);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const finishing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [lanes] = useState<Lane[]>(() => {
    const out: Lane[] = [
      {
        key: "you",
        tag: "BẠN",
        sub: "đang chạy",
        body: "#ffcd75",
        tagColor: "text-gold",
        ghost: false,
        at: () => engine.progress,
        finishMs: null,
      },
    ];
    for (const g of config.ghosts) {
      out.push({
        key: g.kind,
        tag: g.kind === "best" ? "KỶ LỤC" : "TOP",
        sub: `${g.kind === "best" ? "của bạn" : g.name} · ${formatTime(g.durationMs)}`,
        body: g.kind === "best" ? "#73eff7" : "#ef7d57",
        tagColor: g.kind === "best" ? "text-cyan" : "text-orange",
        ghost: true,
        at: (t) => ghostAt(g.points, t),
        finishMs: g.durationMs,
      });
    }
    out.push({
      key: "pace",
      tag: "XE MỐC",
      sub: `về đích ${formatTime(engine.par)} = 2 sao`,
      body: "#a7f070",
      tagColor: "text-lime",
      ghost: true,
      at: (t) => Math.min(1, t / engine.par),
      finishMs: engine.par,
    });
    return out;
  });

  useEffect(
    () =>
      engine.subscribe((n) => {
        const play = (k: Parameters<typeof playSfx>[0]) => soundRef.current && playSfx(k);
        if (n.kind === "key") play("key");
        else if (n.kind === "done") play("hit");
        else if (n.kind === "wrong") {
          play("wrong");
          setShake((s) => s + 1);
        } else if (n.kind === "end") {
          play("win");
          if (!finishing.current) {
            finishing.current = true;
            setOverlay("finishing");
            setTimeout(() => void onFinish(engine.result(), engine.events, engine.words), 1300);
          }
        }
        rerender();
      }),
    [engine, onFinish],
  );

  // animation loop: reveal timer + ghosts move with the clock
  useEffect(() => {
    let id = 0;
    const loop = () => {
      engine.tick();
      rerender();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [engine]);

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
      if (e.key.length === 1) {
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

  const t = engine.elapsed();
  const word = engine.current;
  const positions = lanes.map((l) => {
    if (l.key === "you") return engine.status === "over" ? 1 : engine.progress;
    return l.finishMs !== null && t >= l.finishMs ? 1 : l.at(t);
  });
  const mine = positions[0] ?? 0;
  // a car that already crossed the line ranks by when it did
  const rank =
    1 +
    lanes.filter((l, i) => {
      if (i === 0) return false;
      if (engine.status === "over") return l.finishMs !== null && l.finishMs < t;
      return (positions[i] ?? 0) > mine;
    }).length;
  const correctChars = engine.words.slice(0, engine.idx).reduce((n, w) => n + w.lemma.length, 0);
  const wpm = t < 1500 ? 0 : Math.round((correctChars + engine.typed.length) / 5 / (t / 60000));
  const laneH = lanes.length > 3 ? 64 : 80;
  const done = engine.words.slice(Math.max(0, engine.idx - 3), engine.idx);
  const upcoming = engine.words.slice(engine.idx + 1, engine.idx + 3);

  return (
    <Stage className="bg-navy">
      <div
        className="h-full w-full"
        onPointerDown={() => inputRef.current?.focus()}
        style={{ fontFamily: "inherit" }}
      >
        <input
          ref={inputRef}
          aria-label="Gõ từ tiếng Anh"
          className="absolute h-px w-px opacity-0"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value=""
          onChange={() => {}}
          onCompositionStart={() => engine.status === "playing" && pause("ime")}
        />
        <div className="absolute inset-x-0 top-0 h-[150px] bg-[linear-gradient(#1a1c2c,#29366f)]" />
        <svg
          aria-hidden="true"
          className="absolute top-[86px] left-0"
          width="1280"
          height="56"
          viewBox="0 0 160 7"
          shapeRendering="crispEdges"
        >
          <path
            d="M0 7V5h8V3h6v2h10V2h8v3h12V4h10v3zM56 7V4h10V1h6v3h14V2h8v5zM94 7V5h12V3h8v2h10V1h8v4h12V3h6v4z"
            fill="#333c57"
          />
        </svg>

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
              <span className="font-px t-sm text-cyan">GHOST RACE</span>
              <span className="t-sm text-mist">
                Mốc {unitIdx} · {unitTitle}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hb-hud font-px t-md px-3 py-1 text-gold" data-testid="race-time">
              {formatTime(t)}
            </span>
            <span className="hb-hud font-px t-sm px-3 py-1.5">{wpm} WPM</span>
            <span
              className={`hb-hud font-px t-sm px-3 py-1.5 ${rank === 1 ? "text-lime" : "text-gold"}`}
            >
              HẠNG {rank}/{lanes.length}
            </span>
          </div>
        </div>

        {/* track */}
        <div
          className="absolute inset-x-0 top-[148px] bg-steel"
          style={{ height: laneH * lanes.length }}
        >
          {lanes.map((l, i) => (
            <div
              key={l.key}
              className="absolute inset-x-0 border-abyss border-b-4 last:border-b-0"
              style={{ top: i * laneH, height: laneH }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-1 bg-[repeating-linear-gradient(90deg,transparent_0_40px,rgb(255_255_255/0.08)_40px_60px)]"
              />
              <div className="absolute top-1/2 left-3 z-10 flex w-[150px] -translate-y-1/2 flex-col">
                <span className={`font-px t-sm ${l.tagColor}`}>{l.tag}</span>
                <span className="t-sm truncate text-haze leading-none">{l.sub}</span>
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: TRACK_X + (positions[i] ?? 0) * TRACK_W,
                  opacity: l.ghost ? 0.5 : 1,
                }}
              >
                <Car body={l.body} />
              </div>
            </div>
          ))}
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-[1258px] w-[22px] bg-[repeating-conic-gradient(#f4f4f4_0_25%,#0d0e18_0_50%)] bg-[length:11px_11px]"
          />
          <div aria-hidden="true" className="absolute top-0 bottom-0 left-[168px] w-1 bg-gold/60" />
        </div>

        {/* prompt */}
        <div className="absolute inset-x-0 top-[430px] flex items-start justify-center gap-6">
          <div className="flex w-[210px] flex-col items-end gap-1 pt-2">
            <span className="font-px t-sm text-mist">ĐÃ QUA</span>
            {done.map((w) => (
              <span key={w.id} className="t-md text-lime">
                {w.lemma}
              </span>
            ))}
          </div>
          <div
            key={shake}
            className={`hb-panel flex w-[600px] flex-col items-center gap-3 px-5 py-4 ${shake ? "anim-shake" : ""}`}
          >
            <div className="flex items-center gap-3" data-testid="race-prompt">
              <span className="hb-chip-gold t-sm shrink-0 px-1 text-[#3a1a18] uppercase">
                Nghĩa {Math.min(engine.idx + 1, engine.words.length)}/{engine.words.length}
              </span>
              <span key={word?.id} className="t-xl t-bold anim-pop truncate text-gold">
                {word?.meaningVi ?? "…"}
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[...(word?.lemma ?? "")].map((c, i) => {
                const typed = i < engine.typed.length;
                const shown = !typed && i < engine.revealed;
                return (
                  <span
                    key={i}
                    className={`font-px t-md flex h-[46px] w-[38px] items-center justify-center ${
                      typed
                        ? "bg-green text-snow"
                        : shown
                          ? "bg-plum text-gold"
                          : "bg-ink text-slate"
                    }`}
                    style={{
                      boxShadow: `0 0 0 3px ${i === engine.typed.length ? "#73eff7" : "#0d0e18"}`,
                    }}
                  >
                    {typed || shown ? c.toUpperCase() : "_"}
                  </span>
                );
              })}
            </div>
            <div className="t-sm flex items-center gap-2 whitespace-nowrap text-mist">
              <span>Lộ chữ sau</span>
              <div className="h-2.5 w-40 bg-ink shadow-[0_0_0_2px_#0d0e18]">
                <div
                  className="h-full bg-gold"
                  style={{ width: `${engine.revealLeft() * 100}%` }}
                />
              </div>
              <span>· chữ lộ = cần ôn</span>
            </div>
          </div>
          <div className="flex w-[210px] flex-col gap-1 pt-2">
            <span className="font-px t-sm text-mist">TIẾP THEO</span>
            {upcoming.map((w) => (
              <span key={w.id} className="t-md truncate text-slate">
                {w.meaningVi}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-5 flex items-center justify-center gap-4">
          <span
            className={`hb-hud flex items-center gap-1 px-2 py-1 ${engine.combo >= 5 ? "hb-glow" : ""}`}
          >
            <PixelIcon name="flame" size={18} dim={engine.combo < 2} />
            <span className={`font-px t-md ${engine.combo >= 2 ? "text-orange" : "text-slate"}`}>
              x{engine.combo}
            </span>
          </span>
          <button
            type="button"
            className="hb-btn-grey t-sm flex items-center gap-2 px-3 pt-0.5 pb-1.5 text-snow"
            onClick={() => word && engine.revealed > 0 && speak(word.id, word.lemma)}
            disabled={!word || engine.revealed === 0}
          >
            <PixelIcon name="speaker" size={16} color="#f4f4f4" />
            Nghe (khi đã lộ chữ)
          </button>
          <span className="t-sm text-mist">Gõ đúng chữ → xe tăng tốc. Gõ sai → xe khựng lại.</span>
        </div>

        {overlay === "countdown" && count > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-void/60">
            <div key={count} className="font-px t-gold text-[144px] leading-[144px]">
              {count}
            </div>
            <div className="hb-panel hb-lift flex max-w-[680px] flex-col items-center gap-1 px-5 py-3 text-center">
              <p className="t-md">Đọc nghĩa tiếng Việt, gõ từ tiếng Anh để xe chạy về đích.</p>
              <p className="t-sm text-haze">
                Đua với bóng ma kỷ lục của bạn, người nhanh nhất mốc này và xe mốc 2 sao.
              </p>
              <p className="t-sm text-mist">Hãy tắt bộ gõ tiếng Việt trước khi chơi.</p>
            </div>
          </div>
        )}

        {overlay === "finishing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/70">
            <div className="t-gold text-[72px] leading-[80px]">VỀ ĐÍCH!</div>
            <div className="font-px t-lg text-snow">
              HẠNG {rank} · {formatTime(t)}
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
          <p>Cuộc đua đang dừng (bóng ma cũng dừng). Nhấn Esc để tiếp tục.</p>
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

export function SideButton({
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
      className={`group flex h-[48px] w-[48px] items-center justify-center pb-1 ${
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
