import type { UnitSummary } from "@shared/api";
import type { Difficulty } from "@shared/types";
import { type MouseEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PixelButton, PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { StarRow } from "../components/ui/StarRow";
import { type GameEntry, gameById } from "../games/registry";
import { orb, spriteUrl } from "../lib/pixelart";
import { useMe, useSets, useUnits, useUnitWords } from "../lib/queries";
import { useSettings } from "../store/settings";
import { TrainSetsPage } from "./TrainSetsPage";

const PAGE = 20;
/** word chips shown for the selected unit (keeps the panel short enough for 720p) */
const WORD_PREVIEW = 5;
const COLS = 5;
/** y of the first row (room for the ship above it) and the space kept under the last row */
const ROW_TOP = 78;
const ROW_END = 40;
const LEVELS: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "DỄ" },
  { id: "normal", name: "VỪA" },
  { id: "hard", name: "KHÓ" },
];

const ORBS = {
  done: ["#12302b", "#17574a", "#2c9a5c", "#38b764", "#a7f070", "#e6ffb8"],
  current: ["#5a2a1e", "#9e4a3a", "#ef7d57", "#f5a95f", "#ffcd75", "#fff3cf"],
  open: ["#0f1a45", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#c6fbff"],
  locked: ["#0d0e18", "#1f2238", "#333c57", "#3a4367", "#4a5878", "#576188"],
} as const;

function orbUrl(kind: keyof typeof ORBS, r: number) {
  return spriteUrl(`orb-${kind}-${r}`, () => orb(r, [...ORBS[kind]]));
}

/** horizontal room kept left and right of the outer columns */
const COL_EDGE = 50;

interface Gap {
  x: number;
  y: number;
}

function nodeCenter(i: number, gap: Gap): [number, number] {
  const row = Math.floor(i / COLS);
  const c = i % COLS;
  const col = row % 2 === 0 ? c : COLS - 1 - c;
  return [COL_EDGE + col * gap.x, ROW_TOP + row * gap.y];
}

/**
 * Node spacing that fits a page of units into the board. Below the minimum spacing the board
 * overflows instead, and the viewport scrolls (or drags) to show the rest.
 */
function useBoardGap() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows = PAGE / COLS;
  const fitX = Math.floor((box.w - COL_EDGE * 2) / (COLS - 1));
  const fitY = Math.floor((box.h - ROW_TOP - ROW_END) / (rows - 1));
  const gap: Gap = {
    x: box.w ? Math.max(68, Math.min(106, fitX)) : 106,
    y: box.h ? Math.max(66, Math.min(116, fitY)) : 116,
  };
  const overflows = !!box.w && (fitX < gap.x || fitY < gap.y);
  return [ref, gap, overflows] as const;
}

/** Click-and-drag panning for a scrollable box; a drag never counts as a click on a node. */
function useDragPan() {
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    e.currentTarget.scrollLeft = d.left - dx;
    e.currentTarget.scrollTop = d.top - dy;
  };
  const onPointerUp = () => {
    // keep the flag until the click that follows this pointerup has been swallowed
    setTimeout(() => {
      drag.current = null;
    });
  };
  const onClickCapture = (e: MouseEvent) => {
    if (drag.current?.moved) e.stopPropagation();
  };
  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onClickCapture,
  };
}

function Segment({ a, b, gap, done }: { a: number; b: number; gap: Gap; done: boolean }) {
  const [x1, y1] = nodeCenter(a, gap);
  const [x2, y2] = nodeCenter(b, gap);
  const color = done ? "#ffcd75" : "#3a4367";
  const horizontal = y1 === y2;
  const pattern = `repeating-linear-gradient(${horizontal ? "90deg" : "180deg"},${color} 0 4px,transparent 4px 10px)`;
  const style = horizontal
    ? { top: y1 - 2, left: Math.min(x1, x2), width: Math.abs(x2 - x1), height: 4 }
    : { left: x1 - 2, top: y1, height: y2 - y1, width: 4 };
  return (
    <div
      aria-hidden="true"
      className="absolute"
      style={{
        ...style,
        background: pattern,
        filter: done ? "drop-shadow(0 0 4px rgb(255 205 117 / .6))" : undefined,
      }}
    />
  );
}

/** Four gold corner brackets around the selected node. */
function Brackets({ size }: { size: number }) {
  const arm = "absolute h-3 w-3 border-gold";
  const off = -10;
  return (
    <span
      aria-hidden="true"
      className="anim-pulse pointer-events-none absolute"
      style={{ inset: off, width: size - off * 2, height: size - off * 2 }}
    >
      <span className={`${arm} top-0 left-0 border-t-4 border-l-4`} />
      <span className={`${arm} top-0 right-0 border-t-4 border-r-4`} />
      <span className={`${arm} bottom-0 left-0 border-b-4 border-l-4`} />
      <span className={`${arm} right-0 bottom-0 border-r-4 border-b-4`} />
    </span>
  );
}

export function MapPage() {
  const game = gameById(useParams().gameId);
  if (!game?.map) return <Navigate to="/" replace />;
  if (game.id === "sentence-express") return <TrainSetsPage />;
  return <UnitMap key={game.id} game={game} />;
}

function UnitMap({
  game,
}: {
  game: GameEntry & { id: NonNullable<ReturnType<typeof gameById>>["id"] };
}) {
  const map = game.map as NonNullable<GameEntry["map"]>;
  const nav = useNavigate();
  const me = useMe().data?.user;
  const sets = useSets().data?.sets ?? [];
  const [slug, setSlug] = useState("a1");
  const unitsQ = useUnits(slug, game.id);
  const units = unitsQ.data?.units ?? [];
  const difficulty = useSettings((s) => s.difficulty);
  const setSettings = useSettings((s) => s.set);

  const current = useMemo(
    () => units.find((u) => u.state === "open") ?? units.filter((u) => u.state !== "locked").at(-1),
    [units],
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  // choose the current unit (and its page) when the data first arrives or the set changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to a new set of units
  useEffect(() => {
    if (!current) return;
    setSelectedId(current.id);
    setPage(Math.floor((current.idx - 1) / PAGE));
  }, [slug, unitsQ.data?.set.id, current?.id]);

  const selected: UnitSummary | undefined = units.find((u) => u.id === selectedId) ?? current;
  const pageUnits = units.slice(page * PAGE, page * PAGE + PAGE);
  const pageCount = Math.max(1, Math.ceil(units.length / PAGE));
  const wordsQ = useUnitWords(
    selected && selected.state !== "locked" ? selected.id : null,
    game.id,
  );

  const totalStars = units.reduce((n, u) => n + u.bestStars, 0);
  const bestScore = units.reduce((n, u) => Math.max(n, u.bestScore), 0);
  const canPlay = !!selected && selected.state !== "locked";
  const [boardRef, gap, overflows] = useBoardGap();
  const pan = useDragPan();

  return (
    <div className="mx-auto flex h-full max-w-[1280px] flex-col">
      <div className="flex shrink-0 items-center gap-4 px-8 pt-4">
        <Link
          to="/"
          aria-label="Về Hub"
          className="hb-btn-grey flex h-[52px] w-[52px] items-center justify-center pb-1"
        >
          <PixelIcon name="back" size={14} color="#f4f4f4" />
        </Link>
        <div className="flex flex-col">
          <span className="font-px t-lg t-gold tracking-[2px]">{game.title}</span>
          <span className="t-sm text-mist">{map.subtitle}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {me && (
            <>
              <span className="hb-inset t-sm flex items-center gap-2 px-2 py-1 text-mist">
                Kỷ lục
                <span className="font-px t-md text-gold">{bestScore.toLocaleString("vi-VN")}</span>
              </span>
              <span className="hb-inset t-sm flex items-center gap-2 px-2 py-1 text-mist">
                <PixelIcon name="star" size={20} />
                <span className="font-px t-md text-gold">
                  {totalStars}/{units.length * 3}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-8 pt-4 pb-3 xl:gap-6">
        <PixelPanel className="flex w-[210px] shrink-0 xl:w-[250px] flex-col gap-3 overflow-y-auto">
          <h2 className="t-md t-bold text-gold uppercase">Bộ từ vựng</h2>
          {sets.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSlug(s.slug)}
              aria-pressed={s.slug === slug}
              className={`flex flex-col items-start px-2 pt-0.5 pb-1.5 text-left ${
                s.slug === slug ? "hb-btn-blue text-[#141b3d]" : "hb-btn-dark text-snow"
              }`}
            >
              <span className="t-md">{s.name}</span>
              <span className={`t-sm ${s.slug === slug ? "text-[#29366f]" : "text-mist"}`}>
                {s.unitCount} mốc · {s.cefr.toUpperCase()}
              </span>
            </button>
          ))}
          <Link
            to="/vocab"
            className="hb-btn-dark flex flex-col px-2 pt-0.5 pb-1.5 text-snow no-underline"
          >
            <span className="t-md">Từ của tôi</span>
            <span className="t-sm text-mist">Sổ từ vựng đã lưu</span>
          </Link>
          <p className="t-sm mt-auto text-slate">{map.note}</p>
        </PixelPanel>

        <section
          aria-label="Bản đồ mốc"
          className="hb-inset relative flex min-w-0 flex-1 flex-col overflow-hidden p-4 xl:p-5"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(55_68_121/0.35),transparent_60%),radial-gradient(ellipse_at_80%_90%,rgb(59_93_201/0.25),transparent_55%)]" />
          <div className="relative mb-2 flex shrink-0 items-center justify-between gap-3">
            <h2 className="t-md t-bold whitespace-nowrap uppercase">
              Mốc {page * PAGE + 1}–{Math.min(units.length, page * PAGE + PAGE)}
            </h2>
            <div className="-mr-1 flex min-w-0 gap-2 overflow-x-auto pr-1 pb-1">
              {Array.from({ length: pageCount }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-pressed={p === page}
                  className={`font-px t-sm shrink-0 whitespace-nowrap px-2 pt-0.5 pb-1.5 ${
                    p === page ? "hb-btn-blue text-[#141b3d]" : "hb-btn-dark text-mist"
                  }`}
                >
                  {p * PAGE + 1}–{Math.min(units.length, p * PAGE + PAGE)}
                </button>
              ))}
            </div>
          </div>
          <div
            ref={boardRef}
            {...pan}
            className={`relative min-h-0 flex-1 overflow-auto ${overflows ? "cursor-grab select-none active:cursor-grabbing" : ""}`}
          >
            <div
              className="relative mx-auto"
              style={{
                width: COL_EDGE * 2 + (COLS - 1) * gap.x,
                height: ROW_TOP + (PAGE / COLS - 1) * gap.y + ROW_END,
              }}
            >
              {pageUnits.slice(1).map((u, i) => (
                <Segment key={u.id} a={i} b={i + 1} gap={gap} done={u.state !== "locked"} />
              ))}
              {pageUnits.map((u, i) => {
                const [x, y] = nodeCenter(i, gap);
                const locked = u.state === "locked";
                const isCurrent = u.id === current?.id;
                const kind = isCurrent
                  ? "current"
                  : locked
                    ? "locked"
                    : u.bestStars > 0
                      ? "done"
                      : "open";
                const r = isCurrent ? 17 : 13;
                const size = (r * 2 + 2) * 2;
                return (
                  <button
                    key={u.id}
                    type="button"
                    aria-label={`Mốc ${u.idx}: ${u.titleVi}${locked ? " (đã khoá)" : ""}`}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => setSelectedId(u.id)}
                    className="group absolute flex cursor-pointer items-center justify-center"
                    style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
                  >
                    {isCurrent && (
                      <span className="anim-ring absolute inset-[-6px] rounded-full border-4 border-gold/60" />
                    )}
                    <img
                      src={orbUrl(kind, r)}
                      alt=""
                      className="pixelated absolute inset-0 h-full w-full transition-transform group-hover:-translate-y-1"
                      draggable={false}
                    />
                    {locked ? (
                      <PixelIcon name="lock" size={20} dim className="relative" />
                    ) : (
                      <span
                        className={`font-px relative ${isCurrent ? "t-lg" : "t-md"} text-snow [text-shadow:2px_0_0_#0d0e18,-2px_0_0_#0d0e18,0_2px_0_#0d0e18,0_-2px_0_#0d0e18]`}
                      >
                        {u.idx}
                      </span>
                    )}
                    {!locked && !isCurrent && (
                      <span className="absolute -bottom-4 flex gap-0.5">
                        {[0, 1, 2].map((k) => (
                          <PixelIcon key={k} name="star" size={11} dim={k >= u.bestStars} />
                        ))}
                      </span>
                    )}
                    {isCurrent && (
                      <PixelIcon name="ship" size={40} className="anim-bob absolute -top-12" />
                    )}
                    {u.id === selected?.id && <Brackets size={size} />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <PixelPanel className="flex w-[290px] shrink-0 flex-col gap-3 xl:w-[340px]">
          {selected ? (
            <>
              <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
                <div className="flex items-center justify-between">
                  <span className="hb-chip-dark font-px t-sm px-1 text-cyan">
                    MỐC {selected.idx}/{units.length}
                  </span>
                  <StarRow stars={selected.bestStars} size={22} />
                </div>
                <h2 className="t-md t-bold text-gold [@media(min-height:860px)]:t-lg">
                  {selected.titleVi}
                </h2>
                <div className="hb-inset flex flex-col gap-2 px-3 py-2">
                  <span className="t-sm text-mist">Từ trong mốc ({selected.wordCount})</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.state === "locked" ? (
                      <span className="t-sm text-slate">Mở khoá để xem từ</span>
                    ) : (
                      <>
                        {wordsQ.data?.words.slice(0, WORD_PREVIEW).map((w) => (
                          <span key={w.id} className="hb-chip-grey font-px t-sm px-1 text-snow">
                            {w.lemma}
                          </span>
                        ))}
                        {wordsQ.data && wordsQ.data.words.length > WORD_PREVIEW && (
                          <span className="hb-chip-dark font-px t-sm px-1 text-mist">
                            +{wordsQ.data.words.length - WORD_PREVIEW}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              {map.hasDifficulty && (
                <div className="flex shrink-0 flex-col gap-1">
                  <span className="t-sm text-mist">Độ khó</span>
                  <div className="grid grid-cols-3 gap-2">
                    {LEVELS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setSettings({ difficulty: l.id })}
                        aria-pressed={l.id === difficulty}
                        className={`t-sm px-1 pt-0.5 pb-1.5 ${
                          l.id === difficulty
                            ? "hb-btn-green text-[#12302b] [text-shadow:2px_0_0_currentColor]"
                            : "hb-btn-dark text-mist"
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {canPlay ? (
                <PixelButton
                  tone="gold"
                  size="lg"
                  className="hb-glow shrink-0"
                  onClick={() => nav(`/games/${game.id}/play/${selected.id}?set=${slug}`)}
                >
                  <PixelIcon name="play" size={18} color="#3a1a18" />
                  {map.startLabel}
                </PixelButton>
              ) : selected.guestLocked ? (
                <div className="flex shrink-0 flex-col gap-3">
                  <p className="t-sm text-mist">
                    Khách chỉ chơi được 3 mốc đầu. Đăng nhập để mở tiếp.
                  </p>
                  <PixelLink to="/login" tone="gold">
                    Đăng nhập
                  </PixelLink>
                </div>
              ) : (
                <p className="t-sm shrink-0 text-mist">
                  Đạt ít nhất 1 sao ở mốc trước để mở mốc này.
                </p>
              )}
            </>
          ) : (
            <p className="t-md text-mist">
              {unitsQ.isError ? "Không tải được dữ liệu." : "Đang tải…"}
            </p>
          )}
        </PixelPanel>
      </div>
    </div>
  );
}
