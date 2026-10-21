import { useState } from "react";
import { useLeaderboard, useMe } from "../lib/queries";

export function LeaderboardPage() {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const q = useLeaderboard(period);
  const me = useMe().data?.user;
  return (
    <main className="mx-auto flex max-w-[800px] flex-col gap-5 p-8">
      <h1 className="font-vi text-[28px]">BẢNG XẾP HẠNG · WORD BLASTER</h1>
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
            className={`px-btn min-h-11 cursor-pointer border-0 px-4 py-2 text-2xl ${
              period === id ? "bg-blue text-snow" : "bg-steel text-mist"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="px-box bg-steel">
        {q.data?.entries.length === 0 && (
          <p className="p-5 text-2xl text-mist">
            Chưa có ai trên bảng xếp hạng. Hãy là người đầu tiên!
          </p>
        )}
        {q.data?.entries.map((e) => (
          <div
            key={e.userId}
            className={`flex items-center gap-4 border-b-2 border-abyss px-5 py-3 text-[26px] ${
              e.userId === me?.id ? "bg-navy" : ""
            }`}
          >
            <span className={`font-px w-12 text-sm ${e.rank <= 3 ? "text-gold" : "text-mist"}`}>
              #{e.rank}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.displayName}</span>
            <span className="text-gold">{e.score.toLocaleString("vi-VN")}</span>
          </div>
        ))}
      </div>
      <p className="text-xl text-mist">
        Điểm được server tính lại từ nhật ký phím bấm. Khách không có trên bảng xếp hạng.
      </p>
    </main>
  );
}
