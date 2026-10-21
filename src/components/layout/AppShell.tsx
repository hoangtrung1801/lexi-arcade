import { Link, NavLink, Outlet } from "react-router-dom";
import { useMe } from "../../lib/queries";
import { PixelLink } from "../ui/PixelButton";
import { PixelIcon } from "../ui/PixelIcon";
import { SkyScene } from "./SkyScene";

const NAV = [
  { to: "/", label: "Trò chơi", end: true },
  { to: "/vocab", label: "Sổ từ vựng" },
  { to: "/leaderboard", label: "Xếp hạng" },
];

export function AppShell() {
  const me = useMe();
  const user = me.data?.user;
  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden">
      <SkyScene />
      <header className="relative z-10 shrink-0 bg-[linear-gradient(180deg,#2a304b_0_50%,#29366f_50%_100%)] shadow-[0_2px_0_#4a5878,0_4px_0_#0d0e18,0_10px_18px_rgb(10_11_20/0.5)]">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-8 px-8">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <PixelIcon name="logo" size={30} />
            <span className="font-px t-md t-gold tracking-[2px]">LEXI ARCADE</span>
          </Link>
          <nav aria-label="Điều hướng chính" className="flex gap-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `t-md px-3 pt-0.5 pb-1 no-underline ${
                    isActive
                      ? "hb-chip-blue text-[#141b3d]"
                      : "border-[6px] border-transparent text-mist hover:text-snow"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <div className="hb-inset flex items-center gap-2 px-2" title="Xu">
                  <PixelIcon name="coin" size={20} />
                  <span className="font-px t-md text-gold">
                    {user.coins.toLocaleString("vi-VN")}
                  </span>
                </div>
                <div
                  className="hb-inset flex items-center gap-2 px-2"
                  title="Chuỗi ngày chơi liên tiếp"
                >
                  <PixelIcon name="flame" size={22} />
                  <span className="t-md text-orange">{user.streakDays} ngày</span>
                </div>
                <Link
                  to="/profile"
                  aria-label="Hồ sơ người chơi"
                  className="hb-btn-blue flex h-[52px] w-[52px] items-center justify-center pb-1"
                >
                  <PixelIcon name="avatar" size={28} />
                </Link>
              </>
            ) : (
              <PixelLink to="/login" tone="gold" size="sm">
                Đăng nhập
              </PixelLink>
            )}
          </div>
        </div>
      </header>
      <div className="relative z-10 min-h-0 flex-1">
        <Outlet />
      </div>
      <footer className="t-sm relative z-10 flex shrink-0 justify-center gap-6 pb-1 text-mist">
        <Link to="/about" className="text-mist hover:text-snow">
          Nguồn dữ liệu
        </Link>
        <Link to="/privacy" className="text-mist hover:text-snow">
          Quyền riêng tư
        </Link>
      </footer>
    </div>
  );
}
