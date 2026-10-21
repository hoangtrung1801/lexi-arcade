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
    <main className="mx-auto flex max-w-[1000px] items-center justify-center p-8">
      <PixelPanel tone="navy" className="flex w-full flex-col gap-6 px-10 py-9">
        <div className="flex flex-col items-center gap-3.5">
          <span className="font-vi text-[20px] text-cyan">
            MỐC {round.unitIdx} · {round.unitTitle.toUpperCase()}
          </span>
          <h1 className="font-vi text-[60px] text-gold [text-shadow:4px_4px_0_var(--color-abyss)]">
            {won ? "HOÀN THÀNH!" : "THUA RỒI!"}
          </h1>
          <StarRow stars={result.stars} size={56} big />
        </div>

        <div className="grid grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.l} className="px-inset flex flex-col items-center gap-2 bg-ink p-3.5">
              <span className={`font-px text-xl ${s.c}`}>{s.v}</span>
              <span className="text-[22px] text-mist">{s.l}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-6">
          <div className="px-inset flex min-w-0 flex-1 flex-col gap-2.5 bg-ink px-[18px] py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-vi text-[20px] text-lime">TỪ ĐÃ BẮN HẠ ({learned.length})</h2>
              <span className="text-xl text-mist">Nhấn loa để nghe</span>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
              {learned.map((w) => (
                <div key={w.id} className="flex min-h-8 items-center gap-2.5 text-[23px]">
                  <button
                    type="button"
                    aria-label={`Phát âm ${w.lemma}`}
                    onClick={() => speak(w.id, w.lemma)}
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-0 bg-steel p-0"
                  >
                    <PixelIcon name="speaker" size={15} color="#f4f4f4" />
                  </button>
                  <span>{w.lemma}</span>
                  <span className="truncate text-mist">— {w.meaningVi}</span>
                </div>
              ))}
              {learned.length === 0 && <span className="text-mist">Chưa có từ nào.</span>}
            </div>
          </div>
          <div className="px-inset flex w-[280px] shrink-0 flex-col gap-2.5 bg-ink px-[18px] py-4">
            <h2 className="font-vi text-[20px] text-orange">CẦN ÔN LẠI ({review.length})</h2>
            <div className="flex flex-col gap-2 text-[23px]">
              {review.map((w) => (
                <div key={w.id}>
                  {w.lemma} <span className="text-mist">— {w.meaningVi}</span>
                </div>
              ))}
              {review.length === 0 && <span className="text-mist">Không có, tuyệt vời!</span>}
            </div>
            {review.length > 0 && rewards && (
              <button
                type="button"
                onClick={saveReview}
                className="font-vi px-inset mt-auto min-h-11 cursor-pointer border-0 bg-steel p-3 text-[18px] text-snow"
              >
                + LƯU VÀO SỔ TỪ
              </button>
            )}
          </div>
        </div>

        {rewards ? (
          <div className="flex gap-4 text-2xl">
            <span className="bg-ink px-3 py-1.5">+{rewards.xpGained} XP</span>
            <span className="bg-ink px-3 py-1.5 text-gold">+{rewards.coinsGained} xu</span>
            {rewards.levelUp && (
              <span className="bg-lime px-3 py-1.5 text-ink">LÊN CẤP {rewards.level}!</span>
            )}
            {rewards.unlockedUnitId && (
              <span className="bg-cyan px-3 py-1.5 text-ink">Mở khoá mốc mới</span>
            )}
          </div>
        ) : (
          <p className="bg-ink px-4 py-3 text-2xl leading-tight text-mist">
            Kết quả này <b className="text-snow">chưa được lưu</b>. Đăng nhập để lưu điểm, XP, từ đã
            học và vào bảng xếp hạng.
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <div />
          <div className="flex gap-4">
            <PixelLink to="/" size="md">
              VỀ HUB
            </PixelLink>
            {!rewards && (
              <PixelLink to="/login" tone="green" size="md">
                ĐĂNG NHẬP
              </PixelLink>
            )}
            <PixelButton
              tone="blue"
              onClick={() => nav(`/games/word-blaster/play/${round.unitId}?set=${round.setSlug}`)}
            >
              CHƠI LẠI
            </PixelButton>
            <PixelButton tone="gold" onClick={() => nav("/games/word-blaster")}>
              BẢN ĐỒ ▸
            </PixelButton>
          </div>
        </div>
      </PixelPanel>
    </main>
  );
}
