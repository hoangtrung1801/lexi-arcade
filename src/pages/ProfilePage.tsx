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
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <PixelPanel className="flex flex-col gap-4 p-7">
        <div className="flex items-center gap-4">
          <div className="flex h-[72px] w-[72px] items-center justify-center bg-sky px-inset">
            <PixelIcon name="avatar" size={64} />
          </div>
          <div>
            <div className="text-3xl">{me.displayName}</div>
            <div className="text-xl text-mist">{me.email}</div>
          </div>
        </div>
        <div className="font-px text-[11px] text-lime">LV.{me.level}</div>
        <PixelBar value={me.xp - me.xpForCurrent} max={span} label="Kinh nghiệm" />
        <div className="grid grid-cols-3 gap-2 text-center text-2xl">
          <div className="bg-ink p-2">
            {me.xp}
            <div className="text-lg text-mist">XP</div>
          </div>
          <div className="bg-ink p-2">
            {me.coins}
            <div className="text-lg text-mist">xu</div>
          </div>
          <div className="bg-ink p-2">
            {me.streakDays}
            <div className="text-lg text-mist">ngày liên tiếp</div>
          </div>
        </div>
        <label className="flex flex-col gap-2 text-2xl">
          Tên hiển thị
          <div className="flex gap-3">
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 flex-1 border-0 bg-abyss px-3 text-2xl text-snow"
            />
            <PixelButton tone="blue" size="sm" onClick={rename}>
              LƯU
            </PixelButton>
          </div>
        </label>
      </PixelPanel>
      <PixelButton
        tone="red"
        size="sm"
        onClick={async () => {
          await signOut();
          await qc.invalidateQueries();
          nav("/");
        }}
      >
        ĐĂNG XUẤT
      </PixelButton>
    </main>
  );
}
