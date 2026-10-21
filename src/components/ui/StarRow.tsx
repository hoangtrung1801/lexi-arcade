import { PixelIcon } from "./PixelIcon";

export function StarRow({
  stars,
  total = 3,
  size = 28,
  big = false,
}: {
  stars: number;
  total?: number;
  size?: number;
  big?: boolean;
}) {
  return (
    <div className="flex items-end gap-4" role="img" aria-label={`Đạt ${stars} trên ${total} sao`}>
      {Array.from({ length: total }, (_, i) => (
        <PixelIcon
          key={i}
          name="star"
          size={big && i === 1 ? size * 1.3 : size}
          color={i < stars ? "#ffcd75" : "#333c57"}
        />
      ))}
    </div>
  );
}
