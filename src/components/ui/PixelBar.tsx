interface Props {
  value: number;
  max: number;
  color?: string;
  label?: string;
  className?: string;
  /** fill height in CSS px */
  height?: number;
}

/** Recessed, segmented progress bar. */
export function PixelBar({
  value,
  max,
  color = "var(--color-lime)",
  label,
  className = "",
  height = 10,
}: Props) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`hb-inset ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className="hb-fill transition-[width] duration-300 ease-[steps(6)]"
        style={{ width: `${pct}%`, height, ["--fill" as string]: color }}
      />
    </div>
  );
}
