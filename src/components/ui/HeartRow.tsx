import { PixelIcon } from "./PixelIcon";

export function HeartRow({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex gap-1.5" role="img" aria-label={`Còn ${lives} trên ${max} mạng`}>
      {Array.from({ length: max }, (_, i) => (
        <PixelIcon key={i} name="heart" size={24} color={i < lives ? "#b13e53" : "#566c86"} />
      ))}
    </div>
  );
}
