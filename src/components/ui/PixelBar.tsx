interface Props {
  value: number;
  max: number;
  color?: string;
  label?: string;
  className?: string;
}

/** Segmented progress bar. */
export function PixelBar({
  value,
  max,
  color = "var(--color-lime)",
  label,
  className = "",
}: Props) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div
      className={`px-inset h-4 bg-steel ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: `repeating-linear-gradient(90deg, ${color} 0 10px, transparent 10px 12px)`,
        }}
      />
    </div>
  );
}
