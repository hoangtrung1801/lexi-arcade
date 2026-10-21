import { PixelIcon } from "../ui/PixelIcon";
import { SkyScene } from "./SkyScene";

export function DesktopOnly() {
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <SkyScene />
      <div className="hb-ornate hb-lift relative flex max-w-md flex-col items-center gap-4 p-6">
        <PixelIcon name="logo" size={52} />
        <h1 className="t-lg t-gold uppercase">Hãy mở trên máy tính</h1>
        <p className="t-md text-haze">
          Lexi Arcade cần bàn phím và màn hình rộng ít nhất 1024 px. Bản di động sẽ ra mắt sau.
        </p>
      </div>
    </main>
  );
}
