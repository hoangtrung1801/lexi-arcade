import { Link } from "react-router-dom";
import { PixelBar } from "../components/ui/PixelBar";
import { PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { GAMES } from "../games/registry";
import { BlasterPreview } from "../games/word-blaster/Preview";
import { useClaimQuest, useMe, useQuests, useUnits, useVocab } from "../lib/queries";

function GameGlyph({ glyph, accent }: { glyph: string; accent: string }) {
  return (
    <div className="hb-inset h-[60px] w-[60px] shrink-0 p-0">
      <div
        className="flex h-full w-full items-center justify-center bg-[#1a1c2c]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 45%, ${accent}66, transparent 70%)`,
        }}
      >
        <span className="font-px t-md t-shadow" style={{ color: accent }}>
          {glyph}
        </span>
      </div>
    </div>
  );
}

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
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_40%_35%,#3b5dc9,transparent_75%)]">
            <PixelIcon name="avatar" size={36} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-md t-bold truncate">{me.displayName}</span>
          <span className="hb-chip-green font-px t-md self-start px-1 text-[#12302b]">
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
          { v: learned.data?.counts.learned ?? 0, unit: "từ", l: "Từ đã học", c: "text-gold" },
          { v: done, unit: "mốc", l: "Mốc đã qua", c: "text-cyan" },
          { v: me.streakDays, unit: "ngày", l: "Ngày chơi liền", c: "text-orange" },
        ].map((s) => (
          <div
            key={s.l}
            title={s.l}
            className="hb-inset flex items-baseline justify-center gap-1.5 px-0 py-0"
          >
            <span className={`font-px t-md t-shadow ${s.c}`}>{s.v}</span>
            <span className="t-sm text-mist">{s.unit}</span>
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
    <PixelPanel className="flex min-h-0 flex-1 flex-col gap-3">
      <h2 className="t-md t-bold flex shrink-0 items-center gap-2 text-gold uppercase">
        <PixelIcon name="star" size={20} />
        Nhiệm vụ hôm nay
      </h2>
      {!me && <p className="t-sm text-mist">Đăng nhập để nhận nhiệm vụ hằng ngày.</p>}
      <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
        {quests.data?.quests.map((q) => {
          const complete = q.progress >= q.target;
          return (
            <div key={q.key} className="flex flex-col gap-1">
              <div className="t-sm flex items-center justify-between gap-2">
                <span
                  className={`flex items-center gap-2 ${q.claimed ? "text-lime" : "text-haze"}`}
                >
                  {q.claimed && <PixelIcon name="check" size={14} color="#a7f070" />}
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
      </div>
      {me && <div className="t-sm shrink-0 text-slate">Làm mới lúc 00:00 (giờ Việt Nam)</div>}
    </PixelPanel>
  );
}

function FeaturedGame() {
  const g = GAMES[0];
  const units = useUnits("a1").data;
  const current = units?.units.find((u) => u.state === "open") ?? units?.units.at(-1);
  if (!g) return null;
  return (
    <section className="hb-ornate hb-lift relative flex min-h-0 flex-1">
      <div className="absolute -top-3 left-6 z-10 flex gap-2">
        <span className="hb-chip-red t-sm px-1 text-snow uppercase [text-shadow:0_2px_0_#5c1532]">
          Mới
        </span>
        <span className="hb-chip-dark t-sm px-1 text-cyan">{g.tag}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 pt-8">
        <h2 className="font-px t-xl t-gold tracking-[2px] [@media(min-height:860px)]:t-2xl">
          WORD
          <br />
          BLASTER
        </h2>
        <p className="t-md line-clamp-3 max-w-[520px] text-haze">{g.desc}</p>
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
      <div className="hb-inset m-3 ml-0 flex shrink-0 p-0">
        <BlasterPreview />
      </div>
    </section>
  );
}

export function HubPage() {
  const open = GAMES.filter((g) => g.path).length;
  const soon = GAMES.filter((g) => !g.path);
  return (
    <main className="mx-auto flex h-full max-w-[1280px] gap-6 px-8 pt-5 pb-3">
      <aside className="flex min-h-0 w-[344px] shrink-0 flex-col gap-5">
        <ProfileCard />
        <QuestsCard />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
        <div className="flex shrink-0 items-end gap-4">
          <h1 className="t-lg t-bold mr-auto uppercase">Chọn trò chơi</h1>
          <Link to="/leaderboard" className="t-sm text-gold hover:text-snow">
            Xem bảng xếp hạng ▸
          </Link>
          <span className="t-sm hb-inset px-2 py-0 text-mist">
            <span className="text-gold">{open}</span> / {GAMES.length} game đã mở
          </span>
        </div>
        <FeaturedGame />
        <div className="grid shrink-0 grid-cols-3 gap-5">
          {GAMES.slice(1)
            .filter((g) => g.path)
            .map((g) => (
              <Link
                key={g.id}
                to={g.path ?? "/"}
                title={g.desc}
                className="hb-panel hb-lift flex min-w-0 items-center gap-3 p-3 text-snow no-underline transition-transform hover:-translate-y-1"
              >
                <GameGlyph glyph={g.glyph} accent={g.accent} />
                <div className="flex min-w-0 flex-col">
                  <h3 className="t-sm t-bold truncate">{g.title}</h3>
                  <p className="t-sm truncate text-mist">{g.desc}</p>
                  <span className="t-sm text-lime">Chơi ngay ▸</span>
                </div>
              </Link>
            ))}
          <article
            title={soon.map((g) => `${g.title}: ${g.desc}`).join("\n")}
            className="hb-panel hb-lift flex min-w-0 items-center gap-3 p-3 opacity-80"
          >
            <GameGlyph glyph={`+${soon.length}`} accent="#94b0c2" />
            <div className="flex min-w-0 flex-col">
              <h3 className="t-sm t-bold truncate">SẮP RA MẮT</h3>
              <p className="t-sm truncate text-mist">{soon.map((g) => g.title).join(" · ")}</p>
              <div className="t-sm flex items-center gap-2 text-slate">
                <PixelIcon name="lock" size={16} dim />
                <span className="truncate">Mở từ LV {soon[0]?.unlockLevel}</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
