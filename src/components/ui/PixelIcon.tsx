import { runs } from "../../lib/pixelart";
import { getSprite, type SpriteName } from "../../lib/sprites";

export type IconName = SpriteName;

interface Props {
  name: IconName;
  /** target size in CSS px; the sprite is drawn at the nearest whole-pixel scale */
  size?: number;
  /** tint for mono icons */
  color?: string;
  /** dim violet-grey version (locked, empty) */
  dim?: boolean;
  className?: string;
  label?: string;
}

export function PixelIcon({ name, size = 20, color, dim = false, className, label }: Props) {
  const s = getSprite(name, color, dim);
  const scale = Math.max(1, Math.round(size / Math.max(s.w, s.h)));
  return (
    <svg
      className={`pixelated shrink-0 ${className ?? ""}`}
      width={s.w * scale}
      height={s.h * scale}
      viewBox={`0 0 ${s.w} ${s.h}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {runs(s).map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.c} />
      ))}
    </svg>
  );
}
