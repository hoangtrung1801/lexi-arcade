import { useState } from "react";
import { PixelIcon } from "../components/ui/PixelIcon";
import { useLeaderboard, useMe } from "../lib/queries";

const MEDAL = ["text-gold", "text-haze", "text-orange"];

export function LeaderboardPage() {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const q = useLeaderboard(period);
  const me = useMe().data?.user;
  return (
    <main className="mx-auto flex max-w-[840px] flex-col gap-5 p-8">
      <div className="flex flex-col">
        <h1 className="t-lg t-bold uppercase">Bảng xếp hạng</h1>
        <span className="font-px t-md text-gold">WORD BLASTER</span>
      </div>
      <div className="flex gap-2">
        {(
          [
            ["week", "Tuần này"],
            ["all", "Mọi thời đại"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPeriod(id)}
            aria-pressed={period === id}
            className={`t-md px-3 pt-0.5 pb-1.5 ${
              period === id ? "hb-btn-blue text-[#0c1440]" : "hb-btn-dark text-mist"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="hb-panel hb-lift flex flex-col p-2">
        {q.data?.entries.length === 0 && (
          <p className="t-md p-4 text-mist">
            Chưa có ai trên bảng xếp hạng. Hãy là người đầu tiên!
          </p>
        )}
        {q.data?.entries.map((e) => {
          const mine = e.userId === me?.id;
          return (
            <div
              key={e.userId}
              className={`flex items-center gap-4 px-3 py-2 ${
                mine ? "hb-chip-blue text-[#0c1440]" : "border-[#15112b] border-b-2 last:border-b-0"
              }`}
            >
              <span
                className={`font-px t-md w-14 ${mine ? "" : (MEDAL[e.rank - 1] ?? "text-slate")} ${e.rank <= 3 && !mine ? "t-shadow" : ""}`}
              >
                #{e.rank}
              </span>
              {e.rank <= 3 && <PixelIcon name="star" size={20} dim={e.rank > 1} />}
              <span className="t-md min-w-0 flex-1 truncate">{e.displayName}</span>
              <span className={`font-px t-md ${mine ? "" : "text-gold"}`}>
                {e.score.toLocaleString("vi-VN")}
              </span>
            </div>
          );
        })}
      </div>
      <p className="t-sm text-slate">
        Điểm được server tính lại từ nhật ký phím bấm. Khách không có trên bảng xếp hạng.
      </p>
    </main>
  );
}
