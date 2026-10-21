import type { UnitSummary } from "@shared/api";
import type { Difficulty } from "@shared/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PixelButton, PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { StarRow } from "../components/ui/StarRow";
import { useMe, useSets, useUnits, useUnitWords } from "../lib/queries";
import { useSettings } from "../store/settings";

const PAGE = 20;
const COLS = 5;
const LEVELS: { id: Difficulty; name: string }[] = [
  { id: "easy", name: "DỄ" },
  { id: "normal", name: "VỪA" },
  { id: "hard", name: "KHÓ" },
];

function nodeCenter(i: number): [number, number] {
  const row = Math.floor(i / COLS);
  const c = i % COLS;
  const col = row % 2 === 0 ? c : COLS - 1 - c;
  return [45 + col * 105, 45 + row * 118];
}

function Segment({ a, b, done }: { a: number; b: number; done: boolean }) {
  const [x1, y1] = nodeCenter(a);
  const [x2, y2] = nodeCenter(b);
  const color = done ? "#ffcd75" : "#333c57";
  const horizontal = y1 === y2;
  const pattern = `repeating-linear-gradient(${horizontal ? "90deg" : "180deg"},${color} 0 10px,transparent 10px 16px)`;
  const style = horizontal
    ? {
        top: y1 - 3,
        left: Math.min(x1, x2),
        width: Math.abs(x2 - x1),
        height: 6,
        background: pattern,
      }
    : { left: x1 - 3, top: y1, height: y2 - y1, width: 6, background: pattern };
  return <div aria-hidden="true" className="absolute" style={style} />;
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
      <div className="flex h-20 items-center gap-5 px-8 pt-2">
        <Link
          to="/"
          aria-label="Về Hub"
          className="px-btn flex h-11 w-11 items-center justify-center bg-steel"
        >
          <PixelIcon name="back" size={16} color="#f4f4f4" />
        </Link>
        <div className="flex flex-col gap-1">
          <span className="font-px text-base text-gold">WORD BLASTER</span>
          <span className="text-[22px] text-mist">
            Gõ các từ tiếng Anh đang rơi để bắn hạ chúng
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-2xl">
          {me && (
            <>
              <span className="bg-ink px-3 py-1">
                Kỷ lục: <span className="text-gold">{bestScore.toLocaleString("vi-VN")}</span>
              </span>
              <span className="bg-ink px-3 py-1">
                Sao:{" "}
                <span className="text-gold">
                  {totalStars} / {units.length * 3}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-8 p-8 pt-4">
        <PixelPanel className="flex w-[250px] shrink-0 flex-col gap-3">
          <h2 className="font-vi mb-1.5 text-[20px] text-gold">BỘ TỪ VỰNG</h2>
          {sets.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => setSlug(s.slug)}
              className={`flex min-h-11 cursor-pointer flex-col items-start gap-1 border-0 px-3 py-2.5 text-left ${
                s.slug === slug
                  ? "bg-sky text-ink shadow-[0_0_0_3px_#0d0e18,inset_-3px_-4px_0_rgba(0,0,0,.25)]"
                  : "bg-ink text-snow"
              }`}
            >
              <span className="text-2xl leading-none">{s.name}</span>
              <span className="text-[19px] opacity-80">
                {s.unitCount} mốc · CEFR {s.cefr.toUpperCase()}
              </span>
            </button>
          ))}
          <Link
            to="/vocab"
            className="flex min-h-11 flex-col gap-1 bg-ink px-3 py-2.5 text-snow no-underline"
          >
            <span className="text-2xl leading-none">Từ của tôi</span>
            <span className="text-[19px] opacity-80">Sổ từ vựng đã lưu</span>
          </Link>
          <p className="mt-auto text-xl leading-[1.1] text-mist">
            Mỗi mốc gồm khoảng 12 từ. Đạt 1 sao để mở mốc tiếp theo.
          </p>
        </PixelPanel>

        <PixelPanel tone="deep" aria-label="Bản đồ mốc" className="relative min-w-0 flex-1 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-vi text-[22px]">
              MỐC {page * PAGE + 1}–{Math.min(units.length, page * PAGE + PAGE)}
            </h2>
            <div className="flex gap-2">
              {Array.from({ length: pageCount }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`px-btn font-px min-h-11 cursor-pointer border-0 px-3 py-2.5 text-[10px] ${
                    p === page ? "bg-blue text-snow" : "bg-steel text-mist"
                  }`}
                >
                  {p * PAGE + 1}–{Math.min(units.length, p * PAGE + PAGE)}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mx-auto h-[480px] w-[510px]">
            {pageUnits.slice(1).map((u, i) => (
              <Segment key={u.id} a={i} b={i + 1} done={u.state !== "locked"} />
            ))}
            {pageUnits.map((u, i) => {
              const [x, y] = nodeCenter(i);
              const locked = u.state === "locked";
              const isCurrent = u.id === current?.id;
              const size = isCurrent ? 72 : 60;
              const bg = isCurrent ? "#ef7d57" : locked ? "#333c57" : "#38b764";
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={false}
                  aria-label={`Mốc ${u.idx}: ${u.titleVi}${locked ? " (đã khoá)" : ""}`}
                  onClick={() => setSelectedId(u.id)}
                  className="absolute flex cursor-pointer flex-col items-center justify-center gap-1 border-0"
                  style={{
                    left: x - size / 2,
                    top: y - size / 2,
                    width: size,
                    height: size,
                    background: bg,
                    color: locked ? "#566c86" : "#f4f4f4",
                    boxShadow: `0 0 0 4px ${u.id === selected?.id ? "#ffcd75" : "#0d0e18"}, inset -4px -5px 0 rgba(0,0,0,.28), inset 4px 4px 0 rgba(255,255,255,.2)${isCurrent ? ", 0 0 0 10px rgba(239,125,87,.35)" : ""}`,
                  }}
                >
                  {locked ? (
                    <PixelIcon name="lock" size={20} color="#566c86" />
                  ) : (
                    <span className="font-px text-sm">{u.idx}</span>
                  )}
                  {!locked && !isCurrent && (
                    <span className="font-px text-[8px] tracking-wide text-gold">
                      {"★".repeat(u.bestStars)}
                      {"☆".repeat(3 - u.bestStars)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </PixelPanel>

        <PixelPanel className="flex w-[330px] shrink-0 flex-col gap-3.5 p-[22px]">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <span className="font-vi text-[20px] text-cyan">
                  MỐC {selected.idx}/{units.length}
                </span>
                <span className="text-[22px] text-mist">Unit {selected.idx}</span>
              </div>
              <h2 className="font-vi text-[30px] leading-none text-gold">{selected.titleVi}</h2>
              <StarRow stars={selected.bestStars} size={28} />
              <div className="flex flex-col gap-1.5 bg-ink px-3.5 py-3">
                <span className="text-xl text-mist">Từ trong mốc ({selected.wordCount})</span>
                <div className="flex flex-wrap gap-1.5">
                  {selected.state === "locked" ? (
                    <span className="text-xl text-mist">Mở khoá để xem từ</span>
                  ) : (
                    <>
                      {wordsQ.data?.words.slice(0, 8).map((w) => (
                        <span key={w.id} className="bg-navy px-2 text-[22px]">
                          {w.lemma}
                        </span>
                      ))}
                      {wordsQ.data && wordsQ.data.words.length > 8 && (
                        <span className="bg-navy px-2 text-[22px]">
                          +{wordsQ.data.words.length - 8}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xl text-mist">Độ khó</span>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSettings({ difficulty: l.id })}
                      className={`font-vi min-h-11 cursor-pointer border-0 px-1 py-2 text-[22px] ${
                        l.id === difficulty
                          ? "bg-lime text-ink shadow-[0_0_0_3px_#0d0e18]"
                          : "bg-ink text-mist"
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
                  className="mt-auto"
                  onClick={() => nav(`/games/word-blaster/play/${selected.id}?set=${slug}`)}
                >
                  <PixelIcon name="play" size={16} />
                  BẮT ĐẦU
                </PixelButton>
              ) : selected.guestLocked ? (
                <div className="mt-auto flex flex-col gap-3">
                  <p className="text-xl leading-tight text-mist">
                    Khách chỉ chơi được 3 mốc đầu. Đăng nhập để mở tiếp.
                  </p>
                  <PixelLink to="/login" tone="gold">
                    ĐĂNG NHẬP
                  </PixelLink>
                </div>
              ) : (
                <p className="mt-auto text-xl text-mist">
                  Đạt ít nhất 1 sao ở mốc trước để mở mốc này.
                </p>
              )}
            </>
          ) : (
            <p className="text-2xl text-mist">
              {unitsQ.isError ? "Không tải được dữ liệu." : "Đang tải…"}
            </p>
          )}
        </PixelPanel>
      </div>
    </div>
  );
}
