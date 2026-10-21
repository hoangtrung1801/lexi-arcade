import { PixelIcon } from "./PixelIcon";

export function StarRow({
  stars,
  total = 3,
  size = 22,
  big = false,
}: {
  stars: number;
  total?: number;
  size?: number;
  big?: boolean;
}) {
  return (
    <div className="flex items-end gap-3" role="img" aria-label={`Đạt ${stars} trên ${total} sao`}>
      {Array.from({ length: total }, (_, i) => (
        <PixelIcon
          key={i}
          name="star"
          size={big && i === 1 ? size * 1.5 : size}
          dim={i >= stars}
          className={big && i < stars ? "hb-glow" : ""}
        />
      ))}
    </div>
  );
}
