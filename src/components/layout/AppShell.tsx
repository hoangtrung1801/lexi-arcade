import { Link, NavLink, Outlet } from "react-router-dom";
import { useMe } from "../../lib/queries";
import { PixelLink } from "../ui/PixelButton";
import { PixelIcon } from "../ui/PixelIcon";
import { StarField } from "./StarField";

const NAV = [
  { to: "/", label: "Trò chơi", end: true },
  { to: "/vocab", label: "Sổ từ vựng" },
  { to: "/leaderboard", label: "Xếp hạng" },
];

export function AppShell() {
  const me = useMe();
  const user = me.data?.user;
  return (
    <div className="relative flex min-h-full flex-col">
      <StarField />
      <header className="relative z-10 flex h-[76px] shrink-0 items-center gap-8 border-b-4 border-abyss bg-navy px-8">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <PixelIcon name="logo" size={36} />
          <span className="font-px text-lg tracking-wide text-gold">LEXI ARCADE</span>
        </Link>
        <nav aria-label="Điều hướng chính" className="flex gap-1 text-[26px]">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-4 py-1.5 no-underline ${isActive ? "bg-blue text-snow" : "text-mist hover:text-snow"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[26px]">
          {user ? (
            <>
              <div className="flex items-center gap-2 bg-ink px-3 py-1" title="Xu">
                <PixelIcon name="coin" size={20} />
                <span>{user.coins.toLocaleString("vi-VN")}</span>
              </div>
              <div
                className="flex items-center gap-2 bg-ink px-3 py-1"
                title="Chuỗi ngày chơi liên tiếp"
              >
                <PixelIcon name="flame" size={20} />
                <span>{user.streakDays} ngày</span>
              </div>
              <Link
                to="/profile"
                aria-label="Hồ sơ người chơi"
                className="px-btn flex h-11 w-11 items-center justify-center bg-cyan"
              >
                <PixelIcon name="avatar" size={44} />
              </Link>
            </>
          ) : (
            <PixelLink to="/login" tone="gold" size="sm">
              ĐĂNG NHẬP
            </PixelLink>
          )}
        </div>
      </header>
      <div className="relative z-10 flex-1">
        <Outlet />
      </div>
      <footer className="relative z-10 flex justify-center gap-6 py-3 text-xl text-mist">
        <Link to="/about">Nguồn dữ liệu</Link>
        <Link to="/privacy">Quyền riêng tư</Link>
      </footer>
    </div>
  );
}
