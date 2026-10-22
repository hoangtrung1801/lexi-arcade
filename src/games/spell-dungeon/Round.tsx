import type { GameConfig, GameWord, RoundResult } from "@shared/types";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { PixelButton } from "../../components/ui/PixelButton";
import { PixelIcon } from "../../components/ui/PixelIcon";
import { playSfx, speak } from "../../lib/sfx";
import { useSettings } from "../../store/settings";
import { isImeKey, Stage } from "../common/Stage";
import { SideButton } from "../ghost-race/Round";
import { type Mob, SpellEngine, type SpellStage } from "./engine";

interface Props {
  config: GameConfig & { dueWordIds?: number[] };
  unitIdx: number;
  unitTitle: string;
  onFinish: (
    result: RoundResult,
    events: SpellEngine["events"],
    words: GameConfig["words"],
  ) => Promise<void> | void;
  onExit: () => void;
}

type Overlay = "countdown" | "none" | "paused" | "ime" | "finishing";

/** the floor line every sprite stands on */
const FLOOR = 540;
/** where monsters set off and where they hit the hero */
const MOB_FROM = 940;
const MOB_TO = 250;
const MOB_COLORS = [
  { body: "#38b764", dark: "#257179" },
  { body: "#b13e53", dark: "#5d275d" },
  { body: "#41a6f6", dark: "#3b5dc9" },
];
const STAGES: { key: SpellStage; label: string }[] = [
  { key: "door", label: "1 Cửa" },
  { key: "mob", label: "2 Quái" },
  { key: "boss", label: "3 Boss" },
];

export function Hero({ size = 84, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={(size * 14) / 12}
      viewBox="0 0 12 14"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="5" y="0" width="3" height="1" fill="#b13e53" />
      <rect x="6" y="1" width="3" height="1" fill="#b13e53" />
      <rect x="3" y="2" width="6" height="4" fill="#94b0c2" />
      <rect x="4" y="3" width="5" height="1" fill="#0d0e18" />
      <rect x="3" y="2" width="1" height="4" fill="#c5d6e3" />
      <rect x="2" y="6" width="8" height="5" fill="#566c86" />
      <rect x="5" y="7" width="2" height="2" fill="#ffcd75" />
      <rect x="0" y="6" width="3" height="5" fill="#3b5dc9" />
      <rect x="1" y="7" width="1" height="3" fill="#ffcd75" />
      <rect x="10" y="3" width="1" height="7" fill="#f4f4f4" />
      <rect x="9" y="8" width="3" height="1" fill="#ffcd75" />
      <rect x="3" y="11" width="2" height="3" fill="#333c57" />
      <rect x="7" y="11" width="2" height="3" fill="#333c57" />
    </svg>
  );
}

function MobSprite({ body, dark, size }: { body: string; dark: string; size: number }) {
  return (
    <svg
      width={size}
      height={(size * 11) / 12}
      viewBox="0 0 12 11"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="3" y="0" width="1" height="2" fill={dark} />
      <rect x="8" y="0" width="1" height="2" fill={dark} />
      <rect x="2" y="2" width="8" height="6" fill={body} />
      <rect x="1" y="3" width="10" height="4" fill={body} />
      <rect x="3" y="4" width="2" height="2" fill="#f4f4f4" />
      <rect x="7" y="4" width="2" height="2" fill="#f4f4f4" />
      <rect x="3" y="5" width="1" height="1" fill="#0d0e18" />
      <rect x="7" y="5" width="1" height="1" fill="#0d0e18" />
      <rect x="4" y="7" width="4" height="1" fill="#0d0e18" />
      <rect x="5" y="7" width="1" height="1" fill="#f4f4f4" />
      <rect x="0" y="5" width="1" height="3" fill={dark} />
      <rect x="11" y="5" width="1" height="3" fill={dark} />
      <rect x="2" y="8" width="2" height="3" fill={dark} />
      <rect x="8" y="8" width="2" height="3" fill={dark} />
    </svg>
  );
}

function BossSprite({ eye }: { eye: string }) {
  return (
    <svg
      width="240"
      height="240"
      viewBox="0 0 20 20"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="4" y="0" width="2" height="2" fill="#ffcd75" />
      <rect x="9" y="0" width="2" height="2" fill="#ffcd75" />
      <rect x="14" y="0" width="2" height="2" fill="#ffcd75" />
      <rect x="4" y="2" width="12" height="2" fill="#ffcd75" />
      <rect x="9" y="2" width="2" height="1" fill="#b13e53" />
      <rect x="4" y="4" width="12" height="8" fill="#f4f4f4" />
      <rect x="3" y="5" width="14" height="6" fill="#f4f4f4" />
      <rect x="5" y="6" width="3" height="3" fill="#0d0e18" />
      <rect x="12" y="6" width="3" height="3" fill="#0d0e18" />
      <rect x="6" y="7" width="1" height="1" fill={eye} />
      <rect x="13" y="7" width="1" height="1" fill={eye} />
      <rect x="9" y="9" width="2" height="1" fill="#0d0e18" />
      <rect x="6" y="11" width="8" height="2" fill="#c5d6e3" />
      <rect x="7" y="11" width="1" height="1" fill="#0d0e18" />
      <rect x="9" y="11" width="1" height="1" fill="#0d0e18" />
      <rect x="11" y="11" width="1" height="1" fill="#0d0e18" />
      <rect x="2" y="13" width="16" height="7" fill="#5d275d" />
      <rect x="4" y="13" width="12" height="2" fill="#b13e53" />
      <rect x="9" y="15" width="2" height="5" fill="#ffcd75" />
      <rect x="0" y="14" width="2" height="5" fill="#c5d6e3" />
      <rect x="18" y="12" width="1" height="8" fill="#94b0c2" />
      <rect x="17" y="12" width="3" height="1" fill="#ffcd75" />
    </svg>
  );
}

function Heart({ full }: { full: boolean }) {
  const c = full ? "#b13e53" : "#333c57";
  return (
    <svg width="24" height="21" viewBox="0 0 8 7" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="1" y="0" width="2" height="1" fill={c} />
      <rect x="5" y="0" width="2" height="1" fill={c} />
      <rect x="0" y="1" width="8" height="3" fill={c} />
      <rect x="1" y="4" width="6" height="1" fill={c} />
      <rect x="2" y="5" width="4" height="1" fill={c} />
      <rect x="3" y="6" width="2" height="1" fill={c} />
    </svg>
  );
}

function Torch({ x, lit }: { x: number; lit: boolean }) {
  return (
    <svg
      className="absolute"
      style={{ left: x, top: 290 }}
      width="36"
      height="84"
      viewBox="0 0 6 14"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="2" y="0" width="2" height="1" fill={lit ? "#f4f4f4" : "#ef7d57"} />
      <rect x="1" y="1" width="4" height="2" fill="#ffcd75" />
      <rect x="2" y="2" width="2" height="2" fill="#f4f4f4" />
      <rect x="1" y="3" width="4" height="2" fill="#ef7d57" />
      <rect x="0" y="5" width="6" height="2" fill="#566c86" />
      <rect x="2" y="7" width="2" height="6" fill="#5d275d" />
      <rect x="1" y="13" width="4" height="1" fill="#333c57" />
    </svg>
  );
}

/** the door: two leaves that slide apart when `open` */
function Door({ open }: { open: boolean }) {
  const leaf =
    "absolute top-0 h-[330px] w-[140px] bg-[repeating-linear-gradient(90deg,#5d275d_0_31px,#3d1f45_31px_35px)] transition-transform duration-[600ms] ease-[steps(6)]";
  return (
    <div
      className="absolute left-[470px] h-[390px] w-[340px] bg-[repeating-linear-gradient(0deg,#566c86_0_24px,#333c57_24px_28px)]"
      style={{
        top: FLOOR - 390,
        clipPath:
          "polygon(40px 0,300px 0,300px 20px,320px 20px,320px 40px,340px 40px,340px 390px,0 390px,0 40px,20px 40px,20px 20px,40px 20px)",
      }}
    >
      <div
        className="absolute top-[60px] left-[30px] h-[330px] w-[280px] overflow-hidden bg-orange"
        style={{
          clipPath:
            "polygon(30px 0,250px 0,250px 15px,265px 15px,265px 30px,280px 30px,280px 330px,0 330px,0 30px,15px 30px,15px 15px,30px 15px)",
        }}
      >
        <div className="absolute inset-x-10 top-10 bottom-0 bg-gold" />
        <div className="absolute inset-x-[90px] top-[90px] bottom-0 bg-snow" />
        <div
          className={`${leaf} left-0 shadow-[inset_-3px_0_0_#0d0e18]`}
          style={{ transform: `translateX(${open ? -150 : 0}px)` }}
        >
          <div className="absolute inset-x-0 top-[70px] h-3.5 bg-[#333c57]" />
          <div className="absolute inset-x-0 top-[250px] h-3.5 bg-[#333c57]" />
          <div className="absolute top-[140px] right-[-1px] h-11 w-8 bg-gold shadow-[0_0_0_3px_#0d0e18]">
            <div className="absolute top-2.5 left-3 h-2 w-2 bg-abyss" />
            <div className="absolute top-[18px] left-3.5 h-3.5 w-1 bg-abyss" />
          </div>
        </div>
        <div
          className={`${leaf} right-0 shadow-[inset_3px_0_0_#0d0e18]`}
          style={{ transform: `translateX(${open ? 150 : 0}px)` }}
        >
          <div className="absolute inset-x-0 top-[70px] h-3.5 bg-[#333c57]" />
          <div className="absolute inset-x-0 top-[250px] h-3.5 bg-[#333c57]" />
        </div>
      </div>
    </div>
  );
}

/** the letter boxes of a door or boss word */
function Slots({
  word,
  typed,
  shown,
  done,
}: {
  word: GameWord;
  typed: string;
  shown: number;
  done: boolean;
}) {
  return (
    <div className="flex justify-center gap-2" data-testid="spell-slots">
      {[...word.lemma].map((c, i) => {
        const isTyped = i < typed.length;
        const isShown = !isTyped && i < shown;
        const cursor = !done && i === typed.length;
        return (
          <span
            key={i}
            className={`font-px t-lg flex h-14 w-12 items-center justify-center ${
              done
                ? "bg-gold text-[#3a1a18]"
                : isTyped
                  ? "bg-green text-snow"
                  : isShown
                    ? "bg-navy text-gold"
                    : "bg-navy text-slate"
            }`}
            style={{
              boxShadow: `0 0 0 3px ${cursor ? "#73eff7" : "#0d0e18"},inset -3px -4px 0 rgba(0,0,0,.28)`,
            }}
          >
            {done || isTyped || isShown ? c.toUpperCase() : "_"}
          </span>
        );
      })}
    </div>
  );
}

export function Round({ config, unitIdx, unitTitle, onFinish, onExit }: Props) {
  const [engine] = useState(() => new SpellEngine(config));
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
    (window as unknown as { __spellDungeon?: SpellEngine }).__spellDungeon = engine;
  }
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [overlay, setOverlay] = useState<Overlay>("countdown");
  const [count, setCount] = useState(3);
  const [shake, setShake] = useState(0);
  const [hit, setHit] = useState(0);
  const [hurtAt, setHurtAt] = useState(-1e9);
  const [msg, setMsg] = useState<{ text: string; tone: "good" | "bad" | "info" }>({
    text: "Gõ từng chữ cái của từ tiếng Anh có nghĩa trên",
    tone: "info",
  });
  const [opened, setOpened] = useState<GameWord | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const sound = useSettings((s) => s.sound);
  const setSettings = useSettings((s) => s.set);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const finishing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      engine.subscribe((n) => {
        const play = (k: Parameters<typeof playSfx>[0]) => soundRef.current && playSfx(k);
        if (n.kind === "key") play("key");
        else if (n.kind === "wrong") {
          play("wrong");
          setShake((s) => s + 1);
          setMsg({ text: "Chữ đó chưa đúng, thử chữ khác", tone: "bad" });
        } else if (n.kind === "reveal") {
          setMsg({ text: "Đã lộ một chữ · từ này sẽ được ôn lại", tone: "info" });
        } else if (n.kind === "hurt") {
          play("miss");
          setHurtAt(engine.elapsed());
          setMsg({
            text: engine.stage === "boss" ? "Boss ra đòn! -1 mạng" : "Quái chạm tới bạn! -1 mạng",
            tone: "bad",
          });
        } else if (n.kind === "done") {
          play("hit");
          setHit((h) => h + 1);
          if (n.stage === "door") {
            setOpened(n.word);
            setMsg({ text: `Cửa đã mở! ${n.word.lemma} · ${n.word.meaningVi}`, tone: "good" });
          } else if (n.stage === "mob") {
            setMsg({ text: `Hạ quái! ${n.word.lemma} · ${n.word.meaningVi}`, tone: "good" });
          } else {
            setMsg({ text: `Trúng đòn! ${n.word.lemma} · ${n.word.meaningVi}`, tone: "good" });
          }
        } else if (n.kind === "stage") {
          setOpened(null);
          setBanner(n.stage === "mob" ? "QUÁI VẬT TRÀN RA!" : "BOSS XUẤT HIỆN!");
          setTimeout(() => setBanner(null), 1500);
          setMsg({
            text:
              n.stage === "mob"
                ? "Gõ từ của một con quái để hạ nó. Backspace để đổi mục tiêu."
                : "Gõ đủ các nghĩa của boss trước khi nó ra đòn",
            tone: "info",
          });
        } else if (n.kind === "end") {
          play(n.won ? "win" : "lose");
          if (!finishing.current) {
            finishing.current = true;
            setOverlay("finishing");
            setTimeout(() => void onFinish(engine.result(), engine.events, engine.words), 1500);
          }
        }
        rerender();
      }),
    [engine, onFinish],
  );

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
      if (e.key === "Tab") {
        e.preventDefault();
        engine.hint();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        engine.clear();
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

  const t = engine.elapsed();
  const stage = engine.stage;
  const score = engine.result().score;
  const hurting = t - hurtAt < 400;
  const stageIdx = STAGES.findIndex((s) => s.key === stage);
  const progress =
    stage === "door"
      ? `Cửa ${Math.min(engine.doorIdx + 1, engine.plan.doors.length)}/${engine.plan.doors.length}`
      : stage === "mob"
        ? `Đợt ${engine.waveIdx + 1}/${engine.plan.waves.length}`
        : `Boss ${engine.bossIdx}/${engine.plan.boss.length}`;
  const canHint = engine.difficulty.hints && !!engine.focus;

  return (
    <Stage className={stage === "boss" ? "bg-[#1a1020]" : "bg-[#141a2c]"}>
      <div
        key={hurting ? `hurt-${hurtAt}` : "ok"}
        className={`h-full w-full ${hurting ? "anim-shake" : ""}`}
        onPointerDown={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          aria-label="Đánh vần từ tiếng Anh"
          className="absolute h-px w-px opacity-0"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value=""
          onChange={() => {}}
          onCompositionStart={() => engine.status === "playing" && pause("ime")}
        />
        <Wall boss={stage === "boss"} />
        <div className="absolute inset-x-0 bottom-0 bg-abyss" style={{ top: FLOOR + 6 }} />
        <div
          className="absolute inset-x-0 h-2"
          style={{
            top: FLOOR,
            background: `repeating-linear-gradient(90deg,${stage === "boss" ? "#5d275d" : "#566c86"} 0 40px,#333c57 40px 44px)`,
          }}
        />
        {hurting && <div className="pointer-events-none absolute inset-0 bg-berry/25" />}

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
            <span className="hb-hud font-px t-md px-3 py-1 text-gold" data-testid="spell-score">
              {score.toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="hb-hud flex items-center gap-3 px-3 py-1.5">
            <span className="t-md text-snow" title={unitTitle}>
              Tầng {unitIdx}
            </span>
            {STAGES.map((s, i) => (
              <span
                key={s.key}
                className={`t-sm px-2 shadow-[0_0_0_2px_#0d0e18] ${
                  i < stageIdx
                    ? "bg-green text-snow"
                    : i === stageIdx
                      ? "bg-orange text-[#1a1c2c]"
                      : "bg-navy text-slate"
                }`}
              >
                {s.label}
                {i < stageIdx ? " ✓" : ""}
              </span>
            ))}
            <span className="t-md text-mist" data-testid="spell-progress">
              {progress}
            </span>
          </div>
          <div
            className="hb-hud flex gap-1.5 px-3 py-2"
            role="img"
            aria-label={`Còn ${engine.hearts} trên 4 mạng`}
            data-testid="spell-hearts"
          >
            {[0, 1, 2, 3].map((i) => (
              <Heart key={i} full={i < engine.hearts} />
            ))}
          </div>
        </div>

        {stage === "door" && <DoorStage engine={engine} opened={opened} shake={shake} />}
        {stage === "mob" && <MobStage engine={engine} t={t} hit={hit} />}
        {stage === "boss" && <BossStage engine={engine} t={t} hit={hit} shake={shake} />}

        {/* message + controls */}
        <div
          aria-live="polite"
          className={`t-md absolute inset-x-0 top-[622px] truncate px-8 text-center ${
            msg.tone === "good" ? "text-lime" : msg.tone === "bad" ? "text-orange" : "text-mist"
          }`}
        >
          {msg.text}
        </div>
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-4">
          <span
            className={`hb-hud flex items-center gap-1 px-2 py-1 ${engine.combo >= 5 ? "hb-glow" : ""}`}
          >
            <PixelIcon name="flame" size={18} dim={engine.combo < 2} />
            <span className={`font-px t-md ${engine.combo >= 2 ? "text-orange" : "text-slate"}`}>
              x{engine.combo}
            </span>
          </span>
          {engine.difficulty.hints ? (
            <button
              type="button"
              className="hb-btn-grey t-sm flex items-center gap-2 px-3 pt-0.5 pb-1.5 text-snow"
              onClick={() => engine.hint()}
              disabled={!canHint}
            >
              <PixelIcon name="lock" size={16} color="#ffcd75" />
              Gợi ý 1 chữ (Tab)
            </button>
          ) : (
            <span className="t-sm text-slate">Khó: không có gợi ý</span>
          )}
          <span className="t-sm text-mist">
            Chữ sai không được nhận · lộ chữ hoặc mất mạng = cần ôn
          </span>
        </div>

        {banner && (
          <div className="pointer-events-none absolute inset-x-0 top-[250px] flex justify-center">
            <div className="t-gold anim-pop text-[64px] leading-[72px]">{banner}</div>
          </div>
        )}

        {overlay === "countdown" && count > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-void/60">
            <div key={count} className="font-px t-gold text-[144px] leading-[144px]">
              {count}
            </div>
            <div className="hb-panel hb-lift flex max-w-[720px] flex-col items-center gap-1 px-5 py-3 text-center">
              <p className="t-md">
                Đánh vần từ tiếng Anh theo nghĩa để mở cửa, hạ quái và đánh boss.
              </p>
              <p className="t-sm text-haze">
                Có 4 mạng. Quái chạm tới bạn hoặc boss ra đòn sẽ mất 1 mạng.
              </p>
              <p className="t-sm text-mist">Hãy tắt bộ gõ tiếng Việt trước khi chơi.</p>
            </div>
          </div>
        )}

        {overlay === "finishing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-void/70">
            <div className={`${engine.won ? "t-gold" : "t-ice"} text-[72px] leading-[80px]`}>
              {engine.won ? "HẠ BOSS!" : "HẾT MẠNG!"}
            </div>
            <div className="font-px t-lg text-snow">{score.toLocaleString("vi-VN")}</div>
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
          <p>Hầm ngục đang dừng (quái và boss cũng dừng). Nhấn Esc để tiếp tục.</p>
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

function Wall({ boss }: { boss: boolean }) {
  const [base, brick, mark] = boss
    ? ["#1a1020", "#2a1830", "#5d275d"]
    : ["#141a2c", "#1d2440", "#29366f"];
  const id = boss ? "wall-boss" : "wall";
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
      <defs>
        <pattern id={id} width="64" height="32" patternUnits="userSpaceOnUse">
          <rect width="64" height="32" fill={base} />
          <rect x="0" y="0" width="62" height="14" fill={brick} />
          <rect x="-32" y="16" width="62" height="14" fill={brick} />
          <rect x="32" y="16" width="62" height="14" fill={brick} />
          <rect x="4" y="2" width="10" height="2" fill={mark} />
          <rect x="40" y="18" width="8" height="2" fill={mark} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function MeaningTag({ word, due, small }: { word: GameWord; due: boolean; small?: boolean }) {
  return (
    <>
      <span className="hb-chip-gold t-md shrink-0 px-2.5 whitespace-nowrap text-[#3a1a18]">
        Nghĩa
      </span>
      {due && <ReviewChip />}
      <span
        className={`anim-pop line-clamp-2 max-w-[560px] break-words text-gold ${small || word.meaningVi.length > 18 ? "t-lg" : "t-xl"}`}
      >
        {word.meaningVi}
      </span>
    </>
  );
}

function ReviewChip() {
  return <span className="t-sm shrink-0 bg-orange px-1.5 text-[#1a1c2c]">Ôn</span>;
}

function DoorStage({
  engine,
  opened,
  shake,
}: {
  engine: SpellEngine;
  opened: GameWord | null;
  shake: number;
}) {
  // while a door swings open, keep showing the word that opened it
  const showOpen = engine.busy && !!opened;
  const word = showOpen ? opened : engine.current;
  if (!word) return null;
  return (
    <>
      <div
        className="hb-hud absolute top-[84px] left-1/2 flex max-w-[1000px] -translate-x-1/2 items-center gap-4 py-2 pr-2.5 pl-3"
        data-testid="spell-prompt"
      >
        <MeaningTag key={word.id} word={word} due={engine.due.has(word.id)} />
        {word.ipa && <span className="t-lg shrink-0 text-mist">{word.ipa}</span>}
        <button
          type="button"
          aria-label="Nghe phát âm"
          className="hb-btn-blue flex h-11 w-11 shrink-0 items-center justify-center pb-0.5"
          onClick={() => speak(word.id, word.lemma)}
        >
          <PixelIcon name="speaker" size={18} color="#f4f4f4" />
        </button>
      </div>
      <Torch x={392} lit={showOpen} />
      <Torch x={852} lit={showOpen} />
      <Door open={showOpen} />
      <div className="absolute left-[250px]" style={{ top: FLOOR - 98 }}>
        <Hero size={84} />
      </div>
      <div
        className="hb-hud t-md absolute left-[150px] px-3 py-1 whitespace-nowrap"
        style={{ top: FLOOR - 150 }}
      >
        {showOpen ? "Tuyệt! Đi tiếp nào!" : "Khoá này cần một từ…"}
      </div>
      <div key={shake} className={`absolute inset-x-0 top-[560px] ${shake ? "anim-shake" : ""}`}>
        <Slots
          word={word}
          typed={showOpen ? word.lemma : engine.typed}
          shown={engine.shown(word)}
          done={showOpen}
        />
      </div>
    </>
  );
}

function MobStage({ engine, t, hit }: { engine: SpellEngine; t: number; hit: number }) {
  const alive = engine.mobs.filter((m) => m.alive);
  return (
    <>
      <div className="hb-hud t-md absolute top-[84px] left-1/2 -translate-x-1/2 px-4 py-1 whitespace-nowrap text-mist">
        Đợt quái <span className="text-gold">{engine.waveIdx + 1}</span> · còn{" "}
        <span className="text-gold">{alive.length}</span> con · quái{" "}
        <span className="text-orange">Ôn</span> là từ cần ôn trong Sổ từ
      </div>
      <div className="absolute left-[110px]" style={{ top: FLOOR - 112 }}>
        <Hero size={96} className={hit % 2 ? "translate-x-1" : ""} />
      </div>
      {engine.mobs.map((m) => (
        <MobView key={m.word.id} engine={engine} mob={m} t={t} />
      ))}
      <div className="absolute inset-x-0 top-[566px] flex justify-center">
        <span
          className="font-px t-lg flex h-12 min-w-[320px] items-center justify-center bg-abyss px-4 tracking-[4px] text-gold shadow-[0_0_0_3px_#0d0e18,0_0_0_6px_#566c86]"
          data-testid="spell-typed"
        >
          {engine.typed.toUpperCase() || (
            <span className="t-md tracking-normal text-slate">gõ từ của một con quái…</span>
          )}
        </span>
      </div>
    </>
  );
}

function MobView({ engine, mob, t }: { engine: SpellEngine; mob: Mob; t: number }) {
  const started = t >= mob.startAt;
  const p = engine.mobProgress(mob, t);
  const aimed = engine.targetId === mob.word.id;
  const color = MOB_COLORS[mob.lane % MOB_COLORS.length] ?? MOB_COLORS[0];
  const shown = engine.shown(mob.word);
  const lemma = mob.word.lemma;
  const hint = [...lemma]
    .map((c, i) =>
      aimed && i < engine.typed.length ? c.toUpperCase() : i < shown ? c.toUpperCase() : "_",
    )
    .join("");
  // three rows so tags of monsters walking close together never overlap
  const top = 168 + mob.lane * 124;
  const x = MOB_FROM - p * (MOB_FROM - MOB_TO);
  return (
    <div
      className="absolute flex items-center gap-3 transition-opacity duration-300"
      style={{
        left: x,
        top,
        opacity: mob.alive && started ? 1 : 0,
        transform: mob.alive ? undefined : "translateY(30px)",
      }}
      data-testid="spell-mob"
    >
      <div className={engine.due.has(mob.word.id) ? "scale-110" : ""}>
        <MobSprite body={color.body} dark={color.dark} size={84} />
      </div>
      <div
        className="flex flex-col gap-1 bg-abyss/90 px-3 py-1.5 whitespace-nowrap"
        style={{ boxShadow: `0 0 0 3px ${aimed ? "#73eff7" : "#0d0e18"}` }}
      >
        <div className="flex items-center gap-2">
          {engine.due.has(mob.word.id) && <ReviewChip />}
          <span
            className={`max-w-[200px] truncate ${aimed ? "text-gold" : "text-snow"} ${mob.word.meaningVi.length > 16 ? "t-md" : "t-lg"}`}
          >
            {mob.word.meaningVi}
          </span>
        </div>
        <span className="font-px t-sm tracking-[3px] text-cyan">{hint}</span>
        <div className="h-2 w-24 bg-navy shadow-[0_0_0_2px_#0d0e18]">
          <div
            className={`h-full ${p > 0.6 ? "bg-orange" : "bg-lime"}`}
            style={{ width: `${(1 - p) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function BossStage({
  engine,
  t,
  hit,
  shake,
}: {
  engine: SpellEngine;
  t: number;
  hit: number;
  shake: number;
}) {
  const boss = engine.plan.boss;
  const word = engine.current;
  const rage = engine.bossRage(t);
  const left = boss.length - engine.bossIdx;
  return (
    <>
      <div className="absolute top-[84px] left-1/2 flex w-[640px] -translate-x-1/2 flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="t-lg text-orange">Vua Xương Khô</span>
          <span className="t-md text-mist">
            HP {left}/{boss.length} nghĩa
          </span>
        </div>
        <div className="flex gap-1 bg-abyss p-1" role="img" aria-label="Thanh máu boss">
          {boss.map((w, i) => (
            <div key={w.id} className={`h-[18px] flex-1 ${i < left ? "bg-berry" : "bg-navy"}`} />
          ))}
        </div>
      </div>

      <section
        className="absolute top-[170px] left-11 flex w-[280px] flex-col gap-2"
        aria-label="Các nghĩa của boss"
      >
        <span className="t-sm text-mist">Boss giữ {boss.length} nghĩa</span>
        {boss.map((w, i) => {
          const done = i < engine.bossIdx;
          const now = i === engine.bossIdx;
          return (
            <div
              key={w.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 shadow-[0_0_0_2px_#0d0e18] ${now ? "bg-[#29366f]" : "bg-abyss/80"}`}
            >
              <span
                className={`font-px t-sm w-4 ${done ? "text-lime" : now ? "text-gold" : "text-slate"}`}
              >
                {done ? "✓" : now ? "▸" : "·"}
              </span>
              <span
                className={`t-md flex-1 truncate ${done ? "text-slate line-through" : now ? "text-gold" : "text-snow"}`}
              >
                {w.meaningVi}
              </span>
              {done && <span className="t-md text-lime">{w.lemma}</span>}
              {engine.due.has(w.id) && <ReviewChip />}
            </div>
          );
        })}
      </section>

      <div
        key={hit}
        className="absolute left-[620px] transition-transform duration-300"
        style={{
          top: FLOOR - 240,
          transform: engine.won
            ? "translateY(60px) rotate(8deg)"
            : hit
              ? "translateX(16px)"
              : undefined,
          opacity: engine.won ? 0.15 : 1,
        }}
      >
        <BossSprite eye={rage > 0.7 ? "#b13e53" : "#ef7d57"} />
      </div>
      <div className="absolute left-[330px]" style={{ top: FLOOR - 112 }}>
        <Hero size={96} />
      </div>

      <div className="absolute top-[200px] right-[50px] flex w-[170px] flex-col items-end gap-1.5">
        <span className="t-sm text-orange">Boss ra đòn</span>
        <div className="h-3 w-[170px] bg-navy shadow-[0_0_0_2px_#0d0e18]">
          <div
            className="h-full bg-[repeating-linear-gradient(90deg,#ef7d57_0_8px,transparent_8px_10px)]"
            style={{ width: `${rage * 100}%` }}
            data-testid="spell-rage"
          />
        </div>
        <span className="t-sm text-right text-mist leading-tight">
          Gõ chậm quá boss đánh -1 mạng
        </span>
      </div>

      {word && (
        <>
          <div
            className="hb-hud absolute top-[176px] left-[500px] flex max-w-[520px] items-center gap-3 py-2 pr-3 pl-3"
            data-testid="spell-prompt"
          >
            <MeaningTag key={word.id} word={word} due={engine.due.has(word.id)} small />
          </div>
          <div
            key={shake}
            className={`absolute inset-x-0 top-[560px] ${shake ? "anim-shake" : ""}`}
          >
            <Slots word={word} typed={engine.typed} shown={engine.shown(word)} done={false} />
          </div>
        </>
      )}
    </>
  );
}
