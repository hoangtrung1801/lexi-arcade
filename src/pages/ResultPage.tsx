import { Navigate, useNavigate } from "react-router-dom";
import { PixelButton, PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { StarRow } from "../components/ui/StarRow";
import { toast } from "../components/ui/Toast";
import { useSaveWord } from "../lib/queries";
import { speak } from "../lib/sfx";
import { useLastRound } from "../store/lastRound";

export function ResultPage() {
  const round = useLastRound((s) => s.round);
  const nav = useNavigate();
  const save = useSaveWord();
  if (!round) return <Navigate to="/games/word-blaster" replace />;

  const { result, rewards, words } = round;
  const byId = new Map(words.map((w) => [w.id, w]));
  const learned = result.hitWordIds.flatMap((id) => byId.get(id) ?? []);
  const review = [
    ...new Set([
      ...result.missedWordIds,
      ...result.hitWordIds.filter((id) => !result.cleanWordIds.includes(id)),
    ]),
  ].flatMap((id) => byId.get(id) ?? []);
  const won = result.status === "won";
  const stats = [
    { v: result.score.toLocaleString("vi-VN"), l: "Điểm", c: "text-gold" },
    { v: String(Math.round(result.wpm)), l: "WPM", c: "text-cyan" },
    { v: `${Math.round(result.accuracy * 100)}%`, l: "Chính xác", c: "text-lime" },
    { v: `x${result.maxCombo}`, l: "Combo cao nhất", c: "text-orange" },
  ];

  const saveReview = async () => {
    try {
      await Promise.all(review.map((w) => save.mutateAsync({ wordId: w.id, saved: true })));
      toast(`Đã lưu ${review.length} từ vào sổ từ vựng`, "good");
    } catch {
      toast("Không lưu được. Hãy đăng nhập rồi thử lại.", "bad");
    }
  };

  return (
    <main className="mx-auto flex h-full max-w-[1040px] items-center justify-center overflow-y-auto px-8 py-4">
      <PixelPanel variant="ornate" className="flex w-full flex-col gap-5 px-8 py-6">
        <div className="flex flex-col items-center gap-3">
          <span className="hb-chip-dark t-sm px-2 text-cyan uppercase">
            Mốc {round.unitIdx} · {round.unitTitle}
          </span>
          <h1 className={`${won ? "t-gold" : "t-ice"} text-[72px] leading-[80px] uppercase`}>
            {won ? "Hoàn thành!" : "Thua rồi!"}
          </h1>
          <StarRow stars={result.stars} size={44} big />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.l} className="hb-inset flex flex-col items-center gap-1 py-2">
              <span className={`font-px t-lg t-shadow ${s.c}`}>{s.v}</span>
              <span className="t-sm text-mist">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="hb-inset flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="t-md t-bold text-lime uppercase">Từ đã bắn hạ ({learned.length})</h2>
              <span className="t-sm text-slate">Nhấn loa để nghe</span>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {learned.map((w) => (
                <div key={w.id} className="flex min-h-9 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Phát âm ${w.lemma}`}
                    onClick={() => speak(w.id, w.lemma)}
                    className="hb-btn-grey group flex h-10 w-10 shrink-0 items-center justify-center pb-0.5"
                  >
                    <PixelIcon
                      name="speaker"
                      size={16}
                      color="#f4f4f4"
                      className="relative group-active:top-0.5"
                    />
                  </button>
                  <span className="font-px t-md">{w.lemma}</span>
                  <span className="t-sm truncate text-mist">{w.meaningVi}</span>
                </div>
              ))}
              {learned.length === 0 && <span className="t-sm text-mist">Chưa có từ nào.</span>}
            </div>
          </div>
          <div className="hb-inset flex w-[300px] shrink-0 flex-col gap-2 px-4 py-3">
            <h2 className="t-md t-bold text-orange uppercase">Cần ôn lại ({review.length})</h2>
            <div className="flex flex-col gap-1">
              {review.map((w) => (
                <div key={w.id} className="flex items-baseline gap-2">
                  <span className="font-px t-md">{w.lemma}</span>
                  <span className="t-sm truncate text-mist">{w.meaningVi}</span>
                </div>
              ))}
              {review.length === 0 && <span className="t-sm text-mist">Không có, tuyệt vời!</span>}
            </div>
            {review.length > 0 && rewards && (
              <PixelButton size="sm" className="mt-auto" onClick={saveReview}>
                + Lưu vào sổ từ
              </PixelButton>
            )}
          </div>
        </div>

        {rewards ? (
          <div className="flex flex-wrap gap-3">
            <span className="hb-chip-dark t-md px-2 text-lime">+{rewards.xpGained} XP</span>
            <span className="hb-chip-dark t-md flex items-center gap-2 px-2 text-gold">
              <PixelIcon name="coin" size={20} />+{rewards.coinsGained} xu
            </span>
            {rewards.levelUp && (
              <span className="hb-chip-green t-md px-2 text-[#12302b] uppercase">
                Lên cấp {rewards.level}!
              </span>
            )}
            {rewards.unlockedUnitId && (
              <span className="hb-chip-blue t-md px-2 text-[#141b3d]">Mở khoá mốc mới</span>
            )}
          </div>
        ) : (
          <p className="hb-inset t-sm px-3 py-2 text-mist">
            Kết quả này <b className="text-snow">chưa được lưu</b>. Đăng nhập để lưu điểm, XP, từ đã
            học và vào bảng xếp hạng.
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <PixelLink to="/" size="md">
            Về Hub
          </PixelLink>
          {!rewards && (
            <PixelLink to="/login" tone="green" size="md">
              Đăng nhập
            </PixelLink>
          )}
          <PixelButton
            tone="blue"
            onClick={() => nav(`/games/word-blaster/play/${round.unitId}?set=${round.setSlug}`)}
          >
            Chơi lại
          </PixelButton>
          <PixelButton tone="gold" className="hb-glow" onClick={() => nav("/games/word-blaster")}>
            Bản đồ ▸
          </PixelButton>
        </div>
      </PixelPanel>
    </main>
  );
}
