import { Link } from "react-router-dom";
import { PixelBar } from "../components/ui/PixelBar";
import { PixelLink } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { GAMES } from "../games/registry";
import { useClaimQuest, useMe, useQuests, useUnits, useVocab } from "../lib/queries";

function ProfileCard() {
  const me = useMe().data?.user;
  const units = useUnits("a1").data;
  const learned = useVocab("learned", !!me);
  if (!me) {
    return (
      <PixelPanel className="flex flex-col gap-3.5">
        <h2 className="font-vi text-[22px] text-gold">KHÁCH</h2>
        <p className="text-2xl leading-tight text-snow">
          Bạn đang chơi với tư cách khách: chơi được 3 mốc đầu mỗi bộ và <b>không lưu</b> tiến độ.
        </p>
        <PixelLink to="/login" tone="gold" size="sm">
          ĐĂNG NHẬP ĐỂ LƯU
        </PixelLink>
      </PixelPanel>
    );
  }
  const span = Math.max(1, me.xpForNext - me.xpForCurrent);
  const done = units?.units.filter((u) => u.state === "done").length ?? 0;
  return (
    <PixelPanel className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <div className="flex h-[72px] w-[72px] items-center justify-center bg-sky px-inset">
          <PixelIcon name="avatar" size={64} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-[28px] leading-none">{me.displayName}</span>
          <span className="font-px text-[10px] text-lime">LV.{me.level}</span>
        </div>
      </div>
      <div className="flex justify-between text-[22px] text-mist">
        <span>Kinh nghiệm</span>
        <span>
          {me.xp - me.xpForCurrent} / {span} XP
        </span>
      </div>
      <PixelBar value={me.xp - me.xpForCurrent} max={span} label="Kinh nghiệm" />
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: learned.data?.counts.learned ?? 0, l: "từ đã học", c: "text-gold" },
          { v: done, l: "mốc đã qua", c: "text-cyan" },
          { v: me.streakDays, l: "ngày liên tiếp", c: "text-orange" },
        ].map((s) => (
          <div key={s.l} className="bg-ink px-1 py-2">
            <div className={`font-px text-sm ${s.c}`}>{s.v}</div>
            <div className="text-lg text-mist">{s.l}</div>
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
    <PixelPanel className="flex flex-col gap-3.5">
      <h2 className="font-vi text-[22px] text-gold">NHIỆM VỤ HÔM NAY</h2>
      {!me && (
        <p className="text-2xl leading-tight text-mist">Đăng nhập để nhận nhiệm vụ hằng ngày.</p>
      )}
      {quests.data?.quests.map((q) => {
        const complete = q.progress >= q.target;
        return (
          <div key={q.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-[22px]">
              <span className={q.claimed ? "text-lime line-through" : ""}>{q.title}</span>
              <span className="text-mist">
                {q.progress}/{q.target}
              </span>
            </div>
            <PixelBar
              value={q.progress}
              max={q.target}
              color={complete ? "#a7f070" : "#41a6f6"}
              label={q.title}
            />
            {complete && !q.claimed && (
              <button
                type="button"
                className="font-vi cursor-pointer self-start bg-gold px-2.5 py-2 text-[16px] text-ink"
                onClick={() => claim.mutate(q.key)}
              >
                NHẬN +{q.reward} XU
              </button>
            )}
          </div>
        );
      })}
      {me && <div className="text-xl text-mist">Làm mới lúc 00:00 (giờ Việt Nam)</div>}
    </PixelPanel>
  );
}

function FeaturedGame() {
  const g = GAMES[0];
  const units = useUnits("a1").data;
  const current = units?.units.find((u) => u.state === "open") ?? units?.units.at(-1);
  if (!g) return null;
  return (
    <section className="px-box flex h-[330px] bg-navy">
      <div className="flex flex-1 flex-col gap-4 p-7">
        <div className="flex gap-2.5">
          <span className="font-vi bg-berry px-2 py-1.5 text-[18px]">MỚI</span>
          <span className="font-vi bg-ink px-2 py-1 text-[18px] text-cyan">{g.tag}</span>
        </div>
        <h2 className="font-px text-[32px] leading-tight text-gold [text-shadow:4px_4px_0_var(--color-abyss)]">
          WORD
          <br />
          BLASTER
        </h2>
        <p className="max-w-[380px] text-2xl leading-[1.15]">{g.desc}</p>
        <div className="mt-auto flex items-center gap-4">
          <PixelLink to={g.path ?? "/"} tone="gold" size="lg">
            <PixelIcon name="play" size={16} />
            CHƠI NGAY
          </PixelLink>
          {current && (
            <span className="text-[22px] text-mist">
              Mốc {current.idx} / {units?.set.unitCount} · {units?.set.name}
            </span>
          )}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="relative w-[340px] overflow-hidden border-l-4 border-abyss bg-ink"
      >
        <div className="absolute top-[22px] right-[26px] h-14 w-14 bg-orange shadow-[inset_-8px_-8px_0_#b13e53,inset_6px_6px_0_#ffcd75]" />
        {[
          { t: "apple", l: 30, top: 60, bg: "#38b764", hit: "" },
          { t: "river", l: 170, top: 128, bg: "#5d275d", hit: "riv" },
          { t: "soap", l: 60, top: 190, bg: "#257179", hit: "" },
        ].map((w) => (
          <div
            key={w.t}
            className="font-px absolute px-2.5 py-2 text-xs shadow-[0_0_0_3px_#0d0e18]"
            style={{ left: w.l, top: w.top, background: w.bg }}
          >
            <span className="text-gold">{w.hit}</span>
            {w.t.slice(w.hit.length)}
          </div>
        ))}
        <div className="absolute top-40 left-[207px] h-24 w-1 bg-[repeating-linear-gradient(180deg,#73eff7_0_8px,transparent_8px_12px)]" />
        <div className="absolute bottom-3 left-[186px]">
          <PixelIcon name="ship" size={48} />
        </div>
        <div className="absolute right-0 bottom-0 left-0 h-1.5 bg-berry" />
      </div>
    </section>
  );
}

export function HubPage() {
  const me = useMe().data?.user;
  const open = GAMES.filter((g) => g.path).length;
  return (
    <main className="mx-auto flex max-w-[1280px] gap-8 p-8">
      <aside className="flex w-[300px] shrink-0 flex-col gap-7">
        <ProfileCard />
        <QuestsCard />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <div className="flex items-baseline justify-between">
          <h1 className="font-vi text-[28px]">CHỌN TRÒ CHƠI</h1>
          <span className="text-[22px] text-mist">
            {open} / {GAMES.length} game đã mở
          </span>
        </div>
        <FeaturedGame />
        <div className="grid grid-cols-3 gap-6">
          {GAMES.filter((g) => !g.path).map((g) => (
            <article key={g.id} className="px-box relative flex flex-col gap-2.5 bg-steel p-[18px]">
              <div className="flex items-start justify-between">
                <div
                  className="flex h-12 w-16 items-center justify-center shadow-[0_0_0_3px_#0d0e18]"
                  style={{ background: g.accent }}
                >
                  <span className="font-px text-base text-ink">{g.glyph}</span>
                </div>
                <span className="font-vi bg-ink px-1.5 py-1.5 text-[14px] text-mist">
                  SẮP RA MẮT
                </span>
              </div>
              <h3 className="font-px mt-1 text-xs">{g.title}</h3>
              <p className="text-[21px] leading-[1.1] text-mist">{g.desc}</p>
              <div className="flex items-center gap-2 text-xl text-mist">
                <PixelIcon name="lock" size={16} color="#94b0c2" />
                Mở ở LV.{g.unlockLevel}
                {me && me.level >= g.unlockLevel ? " (đã đủ cấp)" : ""}
              </div>
            </article>
          ))}
        </div>
        <Link to="/leaderboard" className="self-end text-2xl">
          Xem bảng xếp hạng ▸
        </Link>
      </div>
    </main>
  );
}
