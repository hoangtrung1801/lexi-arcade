type Rect = [x: number, y: number, w: number, h: number, color?: string];
interface IconDef {
  w: number;
  h: number;
  rects: Rect[];
}

const ICONS = {
  coin: {
    w: 5,
    h: 5,
    rects: [
      [1, 0, 3, 5, "#ef7d57"],
      [0, 1, 5, 3, "#ef7d57"],
      [1, 1, 3, 3, "#ffcd75"],
      [2, 2, 1, 1, "#ef7d57"],
    ],
  },
  flame: {
    w: 5,
    h: 6,
    rects: [
      [2, 0, 1, 1, "#ef7d57"],
      [1, 1, 3, 1, "#ef7d57"],
      [0, 2, 5, 4, "#ef7d57"],
      [1, 3, 3, 3, "#ffcd75"],
      [2, 4, 1, 2, "#f4f4f4"],
    ],
  },
  heart: {
    w: 8,
    h: 7,
    rects: [
      [1, 0, 2, 1],
      [5, 0, 2, 1],
      [0, 1, 8, 3],
      [1, 4, 6, 1],
      [2, 5, 4, 1],
      [3, 6, 2, 1],
    ],
  },
  star: {
    w: 7,
    h: 7,
    rects: [
      [3, 0, 1, 2],
      [0, 2, 7, 2],
      [1, 4, 5, 1],
      [1, 5, 2, 2],
      [4, 5, 2, 2],
    ],
  },
  play: {
    w: 4,
    h: 4,
    rects: [
      [0, 0, 1, 4],
      [1, 0.5, 1, 3],
      [2, 1, 1, 2],
      [3, 1.5, 1, 1],
    ],
  },
  back: {
    w: 4,
    h: 4,
    rects: [
      [0, 1.5, 1, 1],
      [1, 1, 1, 2],
      [2, 0.5, 1, 3],
      [3, 0, 1, 4],
    ],
  },
  pause: {
    w: 4,
    h: 4,
    rects: [
      [0.5, 0, 1, 4],
      [2.5, 0, 1, 4],
    ],
  },
  close: {
    w: 4,
    h: 4,
    rects: [
      [0, 0, 1, 1],
      [1, 1, 2, 2],
      [3, 0, 1, 1],
      [0, 3, 1, 1],
      [3, 3, 1, 1],
    ],
  },
  speaker: {
    w: 5,
    h: 4,
    rects: [
      [0, 1, 1, 2],
      [1, 0.5, 1, 3],
      [2, 0, 1, 4],
      [3.5, 1, 0.5, 2, "#73eff7"],
    ],
  },
  lock: {
    w: 7,
    h: 8,
    rects: [
      [2, 0, 3, 1],
      [1, 1, 1, 3],
      [5, 1, 1, 3],
      [0, 3, 7, 5],
      [3, 5, 1, 2, "#333c57"],
    ],
  },
  logo: {
    w: 9,
    h: 9,
    rects: [
      [1, 0, 7, 1, "#ffcd75"],
      [0, 1, 9, 7, "#ffcd75"],
      [1, 8, 7, 1, "#ffcd75"],
      [2, 2, 1, 5, "#1a1c2c"],
      [3, 6, 3, 1, "#1a1c2c"],
      [6, 2, 1, 1, "#1a1c2c"],
      [5, 3, 1, 1, "#1a1c2c"],
      [4, 4, 1, 1, "#1a1c2c"],
    ],
  },
  avatar: {
    w: 11,
    h: 11,
    rects: [
      [3, 2, 5, 5, "#ffcd75"],
      [3, 1, 5, 2, "#5d275d"],
      [2, 2, 1, 2, "#5d275d"],
      [4, 4, 1, 1, "#1a1c2c"],
      [6, 4, 1, 1, "#1a1c2c"],
      [5, 6, 1, 1, "#b13e53"],
      [2, 7, 7, 4, "#3b5dc9"],
    ],
  },
  ship: {
    w: 12,
    h: 12,
    rects: [
      [5, 0, 2, 2, "#73eff7"],
      [4, 2, 4, 5, "#41a6f6"],
      [5, 3, 2, 2, "#ffcd75"],
      [2, 6, 8, 3, "#3b5dc9"],
      [0, 8, 3, 2, "#29366f"],
      [9, 8, 3, 2, "#29366f"],
      [4, 9, 4, 1, "#3b5dc9"],
      [5, 10, 2, 2, "#ef7d57"],
    ],
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
  label?: string;
}

/** Pixel-art icon drawn from rectangles on a tiny grid (placeholder until hand-drawn sprites land). */
export function PixelIcon({ name, size = 20, color = "currentColor", className, label }: Props) {
  const icon: IconDef = ICONS[name];
  const scale = size / Math.max(icon.w, icon.h);
  return (
    <svg
      className={`pixelated shrink-0 ${className ?? ""}`}
      width={icon.w * scale}
      height={icon.h * scale}
      viewBox={`0 0 ${icon.w} ${icon.h}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {icon.rects.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill ?? color} />
      ))}
    </svg>
  );
}
