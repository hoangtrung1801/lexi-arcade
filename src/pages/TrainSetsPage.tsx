import { TRAIN_BONUS_MS, TRAIN_LIVES, TRAIN_RUN_MS, TRAIN_STAR_SENTENCES } from "@shared/rules";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PixelButton } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { StarRow } from "../components/ui/StarRow";
import { useLeaderboard, useMe, useTrainSets } from "../lib/queries";

const ACCENT: Record<string, string> = {
  a1: "#a7f070",
  a2: "#73eff7",
  b1: "#ffcd75",
  b2: "#ef7d57",
  c1: "#e88ad6",
  c2: "#f45b69",
};
const MEDAL = ["text-gold", "text-haze", "text-orange"];

const RULES = [
  { k: `${TRAIN_RUN_MS / 1000} GIÂY`, v: "Đồng hồ chạy ngay khi tàu rời ga đầu.", c: "text-gold" },
  { k: `+${TRAIN_BONUS_MS / 1000} GIÂY`, v: "Mỗi câu xếp đúng được thêm giờ.", c: "text-lime" },
  {
    k: `${TRAIN_LIVES} THAN`,
    v: "Xếp sai mất 1 cục than. Hết than là dừng.",
    c: "text-orange",
  },
  { k: "COMBO", v: "Đúng liên tiếp, không gợi ý: điểm nhân tới x3.", c: "text-cyan" },
];

/** Sentence Express: pick a word set, then make the best run you can. */
export function TrainSetsPage() {
  const nav = useNavigate();
  const me = useMe().data?.user;
  const setsQ = useTrainSets();
  const sets = setsQ.data?.sets ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = sets.find((s) => s.slug === picked) ?? sets[0];
  const top = useLeaderboard("sentence-express", "week").data?.entries.slice(0, 5) ?? [];
  const [one, two, three] = TRAIN_STAR_SENTENCES;

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
          <span className="font-px t-lg t-gold tracking-[2px]">SENTENCE EXPRESS</span>
          <span className="t-sm text-mist">
            Chọn bộ từ · xếp càng nhiều câu càng tốt trước khi hết giờ
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 px-8 pt-4 pb-3">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section
            aria-label="Bộ từ vựng"
            className="-m-2 grid min-h-0 flex-1 grid-cols-2 content-start gap-4 overflow-y-auto p-2"
          >
            {sets.map((s) => {
              const on = s.slug === selected?.slug;
              const accent = ACCENT[s.slug] ?? "#94b0c2";
              return (
                <button
                  key={s.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(s.slug)}
                  onDoubleClick={() => nav(`/games/sentence-express/play/${s.slug}`)}
                  className={`hb-panel flex min-h-[150px] flex-col gap-1.5 px-4 py-3 text-left transition-transform hover:-translate-y-1 ${
                    on ? "outline-4 outline-gold outline-offset-2" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-px t-md px-2 py-0.5 text-ink shadow-[0_0_0_3px_#0d0e18]"
                      style={{ background: accent }}
                    >
                      {s.cefr.toUpperCase()}
                    </span>
                    <span className="t-sm text-mist">
                      {s.wordCount} từ · {s.sentenceCount} câu
                    </span>
                  </div>
                  <span className="t-md t-bold">{s.name}</span>
                  <div className="mt-auto flex items-center gap-3">
                    {me ? (
                      <>
                        <span className="t-sm text-mist">Kỷ lục</span>
                        <span className="font-px t-md text-gold">
                          {s.bestScore ? s.bestScore.toLocaleString("vi-VN") : "—"}
                        </span>
                        <StarRow stars={s.bestStars} size={18} />
                      </>
                    ) : (
                      <span className="t-sm truncate text-slate">Đăng nhập để lưu kỷ lục</span>
                    )}
                    <span
                      className="t-sm ml-auto shrink-0 whitespace-nowrap"
                      style={{ color: on ? accent : "#94b0c2" }}
                    >
                      {on ? "Đang chọn ✓" : "Chọn ▸"}
                    </span>
                  </div>
                </button>
              );
            })}
            {setsQ.isError && <p className="t-md text-mist">Không tải được danh sách bộ từ.</p>}
          </section>
          <div className="flex shrink-0 items-center gap-4">
            <p className="t-sm text-mist">
              Câu lấy ngẫu nhiên trong cả bộ, ưu tiên từ cần ôn. Từ xếp đúng được ghi vào Sổ từ
              chung.
            </p>
            <PixelButton
              tone="gold"
              size="lg"
              className="hb-glow ml-auto shrink-0"
              disabled={!selected}
              onClick={() => selected && nav(`/games/sentence-express/play/${selected.slug}`)}
            >
              <PixelIcon name="play" size={18} color="#3a1a18" />
              Lên tàu · {selected?.cefr.toUpperCase() ?? ""}
            </PixelButton>
          </div>
        </div>

        <PixelPanel className="flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto">
          <h2 className="font-px t-sm text-cyan">LUẬT CHƠI</h2>
          {RULES.map((r) => (
            <div key={r.k} className="flex items-baseline gap-3">
              <span className={`font-px t-sm w-[88px] shrink-0 ${r.c}`}>{r.k}</span>
              <span className="t-sm">{r.v}</span>
            </div>
          ))}
          <p className="t-sm text-mist">
            Sao theo số câu đúng: {one} · {two} · {three} câu.
          </p>
          <div className="h-[3px] shrink-0 bg-abyss" />
          <h2 className="font-px t-sm text-gold">TOP TUẦN</h2>
          {top.length === 0 && <p className="t-sm text-mist">Chưa có ai. Hãy là người đầu tiên!</p>}
          {top.map((e) => (
            <div key={e.userId} className="flex items-center gap-3">
              <span className={`font-px t-sm w-8 ${MEDAL[e.rank - 1] ?? "text-slate"}`}>
                #{e.rank}
              </span>
              <span className={`t-sm flex-1 truncate ${e.userId === me?.id ? "text-cyan" : ""}`}>
                {e.displayName}
              </span>
              <span className="font-px t-sm text-gold">{e.score.toLocaleString("vi-VN")}</span>
            </div>
          ))}
        </PixelPanel>
      </div>
    </div>
  );
}
