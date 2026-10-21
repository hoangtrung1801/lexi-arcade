import { useEffect, useRef } from "react";
import { PX } from "../../lib/frames";
import { drawStars, makeStars, paintHills, paintPlanet, paintSky } from "../../lib/sky";

/** Full-screen animated pixel sky behind every page (static when reduced motion is on). */
export function SkyScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let art: ReturnType<typeof build> | null = null;
    let raf = 0;
    let last = 0;
    let shoot = { at: 4, x: 0, y: 0 };

    function build() {
      const w = Math.ceil(window.innerWidth / PX);
      const h = Math.ceil(window.innerHeight / PX);
      const r = Math.round(Math.min(h * 0.12, 60));
      return {
        w,
        h,
        sky: paintSky(w, h),
        planet: paintPlanet(r),
        px: Math.round(w * 0.93 - r * 1.3),
        py: Math.round(h * 0.16 - r * 0.8),
        hills: paintHills(w, Math.round(h * 0.2)),
        stars: makeStars(w, h * 0.85, Math.round((w * h) / 900)),
      };
    }

    const draw = (t: number) => {
      if (!art) return;
      const { w, h } = art;
      ctx.drawImage(art.sky, 0, 0);
      drawStars(ctx, art.stars, t, w, still ? 0 : 0.6);
      ctx.drawImage(art.planet, art.px, art.py + Math.round(Math.sin(t / 6) * 1));
      // shooting star
      const age = t - shoot.at;
      if (age > 0 && age < 0.9) {
        const k = age / 0.9;
        const hx = shoot.x - k * 120;
        const hy = shoot.y + k * 48;
        const trail = ["#ffffff", "#c2f4ff", "#6fd0ff", "#4a5ab0", "#2a2a6a"];
        trail.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(Math.round(hx + i * 5), Math.round(hy - i * 2), 5, 1);
        });
      } else if (age >= 0.9) {
        shoot = { at: t + 5 + Math.random() * 7, x: w * (0.3 + Math.random() * 0.6), y: h * 0.1 };
      }
      ctx.drawImage(art.hills, 0, h - art.hills.height);
    };

    const resize = () => {
      art = build();
      cv.width = art.w;
      cv.height = art.h;
      ctx.imageSmoothingEnabled = false;
      draw(performance.now() / 1000);
    };
    resize();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 30) return;
      last = now;
      draw(now / 1000);
    };
    if (!still) raf = requestAnimationFrame(loop);

    let pending = 0;
    const onResize = () => {
      clearTimeout(pending);
      pending = window.setTimeout(resize, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(pending);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0">
      <canvas ref={ref} className="pixelated h-screen w-screen" />
    </div>
  );
}
