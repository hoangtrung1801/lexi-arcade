import type { MeResponse } from "@shared/api";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PixelBar } from "../components/ui/PixelBar";
import { PixelButton } from "../components/ui/PixelButton";
import { PixelIcon } from "../components/ui/PixelIcon";
import { PixelPanel } from "../components/ui/PixelPanel";
import { toast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { signOut } from "../lib/auth";
import { useMe } from "../lib/queries";

export function ProfilePage() {
  const me = useMe().data?.user;
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState(me?.displayName ?? "");
  if (!me) return null;
  const span = Math.max(1, me.xpForNext - me.xpForCurrent);

  const rename = async () => {
    try {
      const res = await api<MeResponse>("/me/settings", {
        method: "PATCH",
        body: { displayName: name },
      });
      qc.setQueryData(["me"], res);
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast("Đã đổi tên hiển thị", "good");
    } catch {
      toast("Tên phải từ 1 đến 24 ký tự", "bad");
    }
  };

  return (
    <main className="mx-auto flex h-full max-w-[640px] flex-col justify-center gap-5 overflow-y-auto px-8 py-4">
      <PixelPanel variant="ornate" className="flex flex-col gap-4 px-6">
        <div className="flex items-center gap-4">
          <div className="hb-inset h-[88px] w-[88px] p-0">
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_40%_35%,#3b5dc9,transparent_75%)]">
              <PixelIcon name="avatar" size={52} />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="t-lg t-bold truncate">{me.displayName}</div>
            <div className="t-sm truncate text-mist">{me.email}</div>
          </div>
          <span className="hb-chip-green font-px t-md ml-auto self-start px-2 text-[#12302b]">
            LV {me.level}
          </span>
        </div>
        <PixelBar value={me.xp - me.xpForCurrent} max={span} label="Kinh nghiệm" />
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { v: me.xp, l: "XP", c: "text-lime" },
            { v: me.coins, l: "xu", c: "text-gold" },
            { v: me.streakDays, l: "ngày liên tiếp", c: "text-orange" },
          ].map((s) => (
            <div key={s.l} className="hb-inset flex flex-col py-2">
              <span className={`font-px t-lg t-shadow ${s.c}`}>{s.v}</span>
              <span className="t-sm text-mist">{s.l}</span>
            </div>
          ))}
        </div>
        <label className="t-sm flex flex-col gap-2 text-mist">
          Tên hiển thị
          <div className="flex gap-3">
            <div className="hb-inset flex flex-1 items-center px-2 py-0">
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                className="t-md min-h-10 w-full bg-transparent text-snow outline-none"
              />
            </div>
            <PixelButton tone="blue" size="sm" onClick={rename}>
              Lưu
            </PixelButton>
          </div>
        </label>
      </PixelPanel>
      <PixelButton
        tone="red"
        size="sm"
        className="self-end"
        onClick={async () => {
          await signOut();
          await qc.invalidateQueries();
          nav("/");
        }}
      >
        Đăng xuất
      </PixelButton>
    </main>
  );
}
