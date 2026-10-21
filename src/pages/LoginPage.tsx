import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PixelButton } from "../components/ui/PixelButton";
import { PixelPanel } from "../components/ui/PixelPanel";
import { toast } from "../components/ui/Toast";
import { devLogin, signInWithGoogle } from "../lib/auth";

export function LoginPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    try {
      const res = await signInWithGoogle(from);
      if (res.error) throw new Error(res.error.message);
      // on success the browser is redirected to Google, so there is nothing more to do here
    } catch {
      toast("Không đăng nhập được với Google. Thử lại nhé.", "bad");
      setBusy(false);
    }
  };

  const dev = async () => {
    setBusy(true);
    try {
      await devLogin("Dev Player");
      await qc.invalidateQueries();
      nav(from, { replace: true });
    } catch {
      toast("Đăng nhập thử nghiệm chưa được bật (DEV_LOGIN).", "bad");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8 pt-16">
      <PixelPanel tone="navy" className="flex flex-col gap-5 p-8">
        <h1 className="font-vi text-[32px] text-gold">ĐĂNG NHẬP</h1>
        <p className="text-2xl leading-tight">
          Đăng nhập bằng Google để lưu tiến độ, XP, xu, từ đã học và lên bảng xếp hạng.
        </p>
        <PixelButton tone="gold" size="lg" disabled={busy} onClick={google}>
          TIẾP TỤC VỚI GOOGLE
        </PixelButton>
        {(import.meta.env.DEV || import.meta.env.VITE_E2E === "1") && (
          <PixelButton tone="grey" size="sm" disabled={busy} onClick={dev}>
            ĐĂNG NHẬP THỬ (CHỈ DEV)
          </PixelButton>
        )}
        <p className="text-xl text-mist">
          Không muốn đăng nhập? Bạn vẫn chơi được 3 mốc đầu mỗi bộ, nhưng sẽ không có dữ liệu nào
          được lưu.
        </p>
      </PixelPanel>
    </main>
  );
}
