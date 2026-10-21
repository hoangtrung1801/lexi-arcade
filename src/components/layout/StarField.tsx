import { useMemo } from "react";

/** Static decorative stars (deterministic so it does not flicker between renders). */
export function StarField({ count = 48 }: { count?: number }) {
  const stars = useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: count }, () => ({
      left: `${(rnd() * 100).toFixed(2)}%`,
      top: `${(rnd() * 100).toFixed(2)}%`,
      size: rnd() > 0.8 ? 4 : 2,
      color: rnd() > 0.7 ? "#73eff7" : "#94b0c2",
    }));
  }, [count]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute opacity-60"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, background: s.color }}
        />
      ))}
    </div>
  );
}
