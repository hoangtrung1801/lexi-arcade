import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "../lib/queries";

export function RequireAuth() {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <p className="p-8 text-3xl text-mist">Đang tải…</p>;
  if (!me.data?.user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}
