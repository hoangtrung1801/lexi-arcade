import { Link } from "react-router-dom";
import { PixelBar } from "../components/ui/PixelBar";
import { PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { GAMES } from "../games/registry";
import { BlasterPreview } from "../games/word-blaster/Preview";
import { useClaimQuest, useMe, useQuests, useUnits, useVocab } from "../lib/queries";

function ProfileCard() {
  const me = useMe().data?.user;
  const units = useUnits("a1").data;
  const learned = useVocab("learned", !!me);
  if (!me) {
    return (
      <PixelPanel className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="hb-inset flex h-[64px] w-[64px] items-center justify-center">
            <PixelIcon name="avatar" size={36} dim />
          </div>
          <div className="flex flex-col">
            <h2 className="t-md t-bold text-gold uppercase">Khách</h2>
            <span className="t-sm text-mist">Chưa đăng nhập</span>
          </div>
        </div>
        <p className="t-sm text-haze">
          Bạn chơi được 3 mốc đầu mỗi bộ, nhưng tiến độ <b className="text-snow">không được lưu</b>.
        </p>
        <PixelLink to="/login" tone="gold" size="sm">
          Đăng nhập để lưu
        </PixelLink>
      </PixelPanel>
    );
  }
  const span = Math.max(1, me.xpForNext - me.xpForCurrent);
  const done = units?.units.filter((u) => u.state === "done").length ?? 0;
  return (
    <PixelPanel className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="hb-inset h-[64px] w-[64px] p-0">
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_40%_35%,#2f5bd0,transparent_75%)]">
            <PixelIcon name="avatar" size={36} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-md t-bold truncate">{me.displayName}</span>
          <span className="hb-chip-green font-px t-md self-start px-1 text-[#0f2d2c]">
            LV {me.level}
          </span>
        </div>
      </div>
      <div className="t-sm flex justify-between text-mist">
        <span>Kinh nghiệm</span>
        <span className="text-haze">
          {me.xp - me.xpForCurrent} / {span} XP
        </span>
      </div>
      <PixelBar value={me.xp - me.xpForCurrent} max={span} label="Kinh nghiệm" />
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: learned.data?.counts.learned ?? 0, l: "từ đã học", c: "text-gold" },
          { v: done, l: "mốc đã qua", c: "text-cyan" },
          { v: me.streakDays, l: "ngày liền", c: "text-orange" },
        ].map((s) => (
          <div key={s.l} className="hb-inset flex flex-col items-center px-0 py-1">
            <span className={`font-px t-md t-shadow ${s.c}`}>{s.v}</span>
            <span className="t-sm text-mist">{s.l}</span>
          </div>
        ))}
      </div>
    </PixelPanel>
  );
}

function QuestsCard() {
  const me = useMe().data?.user;
  const quests = useQuests(!!me);
  const claim = useClaimQuest();
  return (
    <PixelPanel className="flex flex-col gap-3">
      <h2 className="t-md t-bold flex items-center gap-2 text-gold uppercase">
        <PixelIcon name="star" size={20} />
        Nhiệm vụ hôm nay
      </h2>
      {!me && <p className="t-sm text-mist">Đăng nhập để nhận nhiệm vụ hằng ngày.</p>}
      {quests.data?.quests.map((q) => {
        const complete = q.progress >= q.target;
        return (
          <div key={q.key} className="flex flex-col gap-1">
            <div className="t-sm flex items-center justify-between gap-2">
              <span className={`flex items-center gap-2 ${q.claimed ? "text-lime" : "text-haze"}`}>
                {q.claimed && <PixelIcon name="check" size={14} color="#b4f57a" />}
                {q.title}
              </span>
              <span className="text-mist">
                {q.progress}/{q.target}
              </span>
            </div>
            <PixelBar
              value={q.progress}
              max={q.target}
              color={complete ? "var(--color-lime)" : "var(--color-cyan)"}
              label={q.title}
              height={8}
            />
            {complete && !q.claimed && (
              <button
                type="button"
                className="hb-btn-gold t-sm mt-1 self-start px-2 pb-1 text-[#3a1a18] uppercase"
                onClick={() => claim.mutate(q.key)}
              >
                <span className="flex items-center gap-2">
                  Nhận +{q.reward}
                  <PixelIcon name="coin" size={20} />
                </span>
              </button>
            )}
          </div>
        );
      })}
      {me && <div className="t-sm text-slate">Làm mới lúc 00:00 (giờ Việt Nam)</div>}
    </PixelPanel>
  );
}

function FeaturedGame() {
  const g = GAMES[0];
  const units = useUnits("a1").data;
  const current = units?.units.find((u) => u.state === "open") ?? units?.units.at(-1);
  if (!g) return null;
  return (
    <section className="hb-ornate hb-lift flex">
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex gap-2">
          <span className="hb-chip-red t-sm px-1 text-snow uppercase [text-shadow:0_2px_0_#5c1532]">
            Mới
          </span>
          <span className="hb-chip-dark t-sm px-1 text-cyan">{g.tag}</span>
        </div>
        <h2 className="font-px t-2xl t-gold mt-1 tracking-[2px]">
          WORD
          <br />
          BLASTER
        </h2>
        <p className="t-md max-w-[400px] text-haze">{g.desc}</p>
        <div className="mt-auto flex items-center gap-4 pt-2">
          <PixelLink to={g.path ?? "/"} tone="gold" size="lg" className="hb-glow">
            <PixelIcon name="play" size={18} color="#3a1a18" />
            Chơi ngay
          </PixelLink>
          {current && (
            <span className="t-sm text-mist">
              Mốc {current.idx} / {units?.set.unitCount}
              <br />
              {units?.set.name}
            </span>
          )}
        </div>
      </div>
      <div className="hb-inset m-3 ml-0 flex shrink-0 items-center p-0">
        <BlasterPreview />
      </div>
    </section>
  );
}

export function HubPage() {
  const me = useMe().data?.user;
  const open = GAMES.filter((g) => g.path).length;
  return (
    <main className="mx-auto flex max-w-[1280px] gap-6 p-8">
      <aside className="flex w-[344px] shrink-0 flex-col gap-6">
        <ProfileCard />
        <QuestsCard />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex items-end justify-between">
          <h1 className="t-lg t-bold uppercase">Chọn trò chơi</h1>
          <span className="t-sm hb-inset px-2 py-0 text-mist">
            <span className="text-gold">{open}</span> / {GAMES.length} game đã mở
          </span>
        </div>
        <FeaturedGame />
        <div className="grid grid-cols-3 gap-5">
          {GAMES.filter((g) => !g.path).map((g) => (
            <article key={g.id} className="hb-panel hb-lift relative flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between">
                <div className="hb-inset h-[64px] w-[80px] p-0">
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background: `radial-gradient(circle at 50% 45%, ${g.accent}66, transparent 70%)`,
                    }}
                  >
                    <span className="font-px t-md t-shadow" style={{ color: g.accent }}>
                      {g.glyph}
                    </span>
                  </div>
                </div>
                <span className="hb-chip-dark t-sm px-1 text-mist uppercase">Sắp ra mắt</span>
              </div>
              <h3 className="font-px t-md t-shadow mt-1 tracking-[1px]">{g.title}</h3>
              <p className="t-sm text-mist">{g.desc}</p>
              <div className="t-sm mt-auto flex items-center gap-2 text-slate">
                <PixelIcon name="lock" size={20} dim />
                Mở ở LV {g.unlockLevel}
                {me && me.level >= g.unlockLevel ? " (đã đủ cấp)" : ""}
              </div>
            </article>
          ))}
        </div>
        <Link to="/leaderboard" className="t-md self-end text-gold hover:text-snow">
          Xem bảng xếp hạng ▸
        </Link>
      </div>
    </main>
  );
}
