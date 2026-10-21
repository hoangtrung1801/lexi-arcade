import { PixelIcon } from "../ui/PixelIcon";

export function DesktopOnly() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <PixelIcon name="logo" size={64} />
      <h1 className="font-vi text-[28px] leading-relaxed text-gold">HÃY MỞ TRÊN MÁY TÍNH</h1>
      <p className="max-w-md text-3xl leading-tight text-snow">
        Lexi Arcade cần bàn phím và màn hình rộng ít nhất 1024 px. Bản di động sẽ ra mắt sau.
      </p>
    </main>
  );
}
