import type { UnitSummary } from "@shared/api";
import type { Difficulty } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PixelButton, PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { StarRow } from "../components/ui/StarRow";
import { orb, spriteUrl } from "../lib/pixelart";
import { useMe, useSets, useUnits, useUnitWords } from "../lib/queries";
import { useSettings } from "../store/settings";

const PAGE = 20;
const COLS = 5;
const LEVELS: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "DỄ" },
  { id: "normal", name: "VỪA" },
  { id: "hard", name: "KHÓ" },
];

const ORBS = {
  done: ["#0f2d2c", "#17574a", "#2c9a5c", "#5fd36a", "#b4f57a", "#e6ffb8"],
  current: ["#5a2a1e", "#a35a2a", "#e0862f", "#f7b538", "#ffd866", "#fff6c4"],
  open: ["#0f1a45", "#1d3383", "#2f5bd0", "#3f8ff0", "#6fd0ff", "#c2f4ff"],
  locked: ["#0c0a1a", "#1a1533", "#2b2550", "#3a3170", "#4a3f7a", "#5a4d92"],
} as const;

function orbUrl(kind: keyof typeof ORBS, r: number) {
  return spriteUrl(`orb-${kind}-${r}`, () => orb(r, [...ORBS[kind]]));
}

function nodeCenter(i: number): [number, number] {
  const row = Math.floor(i / COLS);
  const c = i % COLS;
  const col = row % 2 === 0 ? c : COLS - 1 - c;
  return [50 + col * 106, 78 + row * 116];
}

function Segment({ a, b, done }: { a: number; b: number; done: boolean }) {
  const [x1, y1] = nodeCenter(a);
  const [x2, y2] = nodeCenter(b);
  const color = done ? "#ffd866" : "#3a3170";
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
        filter: done ? "drop-shadow(0 0 4px rgb(255 216 102 / .6))" : undefined,
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
  const nav = useNavigate();
  const me = useMe().data?.user;
  const sets = useSets().data?.sets ?? [];
  const [slug, setSlug] = useState("a1");
  const unitsQ = useUnits(slug);
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
  const wordsQ = useUnitWords(selected && selected.state !== "locked" ? selected.id : null);

  const totalStars = units.reduce((n, u) => n + u.bestStars, 0);
  const bestScore = units.reduce((n, u) => Math.max(n, u.bestScore), 0);
  const canPlay = !!selected && selected.state !== "locked";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex items-center gap-4 px-8 pt-6">
        <Link
          to="/"
          aria-label="Về Hub"
          className="hb-btn-grey flex h-[52px] w-[52px] items-center justify-center pb-1"
        >
          <PixelIcon name="back" size={14} color="#f6f1ff" />
        </Link>
        <div className="flex flex-col">
          <span className="font-px t-lg t-gold tracking-[2px]">WORD BLASTER</span>
          <span className="t-sm text-mist">Gõ các từ tiếng Anh đang rơi để bắn hạ chúng</span>
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

      <div className="flex gap-6 p-8 pt-5">
        <PixelPanel className="flex w-[250px] shrink-0 flex-col gap-3">
          <h2 className="t-md t-bold text-gold uppercase">Bộ từ vựng</h2>
          {sets.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSlug(s.slug)}
              aria-pressed={s.slug === slug}
              className={`flex flex-col items-start px-2 pt-0.5 pb-1.5 text-left ${
                s.slug === slug ? "hb-btn-blue text-[#0c1440]" : "hb-btn-dark text-snow"
              }`}
            >
              <span className="t-md">{s.name}</span>
              <span className={`t-sm ${s.slug === slug ? "text-[#1d3383]" : "text-mist"}`}>
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
          <p className="t-sm mt-auto text-slate">
            Mỗi mốc gồm khoảng 12 từ. Đạt 1 sao để mở mốc tiếp theo.
          </p>
        </PixelPanel>

        <section
          aria-label="Bản đồ mốc"
          className="hb-inset relative min-w-0 flex-1 overflow-hidden p-5"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgb(74_42_134/0.35),transparent_60%),radial-gradient(ellipse_at_80%_90%,rgb(47_91_208/0.25),transparent_55%)]" />
          <div className="relative mb-2 flex items-center justify-between">
            <h2 className="t-md t-bold uppercase">
              Mốc {page * PAGE + 1}–{Math.min(units.length, page * PAGE + PAGE)}
            </h2>
            <div className="flex gap-2">
              {Array.from({ length: pageCount }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-pressed={p === page}
                  className={`font-px t-sm px-2 pt-0.5 pb-1.5 ${
                    p === page ? "hb-btn-blue text-[#0c1440]" : "hb-btn-dark text-mist"
                  }`}
                >
                  {p * PAGE + 1}–{Math.min(units.length, p * PAGE + PAGE)}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mx-auto h-[500px] w-[530px]">
            {pageUnits.slice(1).map((u, i) => (
              <Segment key={u.id} a={i} b={i + 1} done={u.state !== "locked"} />
            ))}
            {pageUnits.map((u, i) => {
              const [x, y] = nodeCenter(i);
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
                      className={`font-px relative ${isCurrent ? "t-lg" : "t-md"} text-snow [text-shadow:2px_0_0_#0c0a1a,-2px_0_0_#0c0a1a,0_2px_0_#0c0a1a,0_-2px_0_#0c0a1a]`}
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
        </section>

        <PixelPanel className="flex w-[340px] shrink-0 flex-col gap-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <span className="hb-chip-dark font-px t-sm px-1 text-cyan">
                  MỐC {selected.idx}/{units.length}
                </span>
                <span className="t-sm text-mist">Unit {selected.idx}</span>
              </div>
              <h2 className="t-lg t-bold text-gold">{selected.titleVi}</h2>
              <StarRow stars={selected.bestStars} size={22} />
              <div className="hb-inset flex flex-col gap-2 px-3 py-2">
                <span className="t-sm text-mist">Từ trong mốc ({selected.wordCount})</span>
                <div className="flex flex-wrap gap-1.5">
                  {selected.state === "locked" ? (
                    <span className="t-sm text-slate">Mở khoá để xem từ</span>
                  ) : (
                    <>
                      {wordsQ.data?.words.slice(0, 8).map((w) => (
                        <span key={w.id} className="hb-chip-grey font-px t-sm px-1 text-snow">
                          {w.lemma}
                        </span>
                      ))}
                      {wordsQ.data && wordsQ.data.words.length > 8 && (
                        <span className="hb-chip-dark font-px t-sm px-1 text-mist">
                          +{wordsQ.data.words.length - 8}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
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
                          ? "hb-btn-green text-[#0f2d2c] [text-shadow:2px_0_0_currentColor]"
                          : "hb-btn-dark text-mist"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              {canPlay ? (
                <PixelButton
                  tone="gold"
                  size="lg"
                  className="hb-glow mt-auto"
                  onClick={() => nav(`/games/word-blaster/play/${selected.id}?set=${slug}`)}
                >
                  <PixelIcon name="play" size={18} color="#3a1a18" />
                  Bắt đầu
                </PixelButton>
              ) : selected.guestLocked ? (
                <div className="mt-auto flex flex-col gap-3">
                  <p className="t-sm text-mist">
                    Khách chỉ chơi được 3 mốc đầu. Đăng nhập để mở tiếp.
                  </p>
                  <PixelLink to="/login" tone="gold">
                    Đăng nhập
                  </PixelLink>
                </div>
              ) : (
                <p className="t-sm mt-auto text-mist">
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
