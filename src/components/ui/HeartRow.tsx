import { PixelIcon } from "./PixelIcon";

export function HeartRow({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex gap-1" role="img" aria-label={`Còn ${lives} trên ${max} mạng`}>
      {Array.from({ length: max }, (_, i) => (
        <PixelIcon
          key={i}
          name="heart"
          size={20}
          dim={i >= lives}
          className={i === lives - 1 && lives <= 1 ? "anim-pulse" : ""}
        />
      ))}
    </div>
  );
}
