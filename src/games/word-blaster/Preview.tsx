import { useEffect, useRef } from "react";
import { toCanvas } from "../../lib/pixelart";
import { drawStars, makeStars, paintPlanet, paintSky } from "../../lib/sky";
import { getSprite } from "../../lib/sprites";
import { PLATE_H, paintPlate, plateWidth, WORD_FONT } from "./art";

const W = 150;
const H = 216;
const WORDS = ["apple", "river", "soap", "cloud", "music", "green", "bread", "happy"];

interface Plate {
  text: string;
  x: number;
  y: number;
  typed: number;
  tone: number;
  speed: number;
  /** fully typed, waiting for its last bullet */
  dying: boolean;
}
interface Bullet {
  x: number;
  y: number;
  plate: Plate;
  final: boolean;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

/** Self-playing miniature of the game for the hub card (decorative). Fills its parent's height. */
export function BlasterPreview({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sky = paintSky(W, H, 21);
    const planet = paintPlanet(13, 8);
    const ship = toCanvas(getSprite("ship"));
    const stars = makeStars(W, H, 60, 9);
    let n = 0;
    const spawn = (y: number): Plate => {
      const text = WORDS[n % WORDS.length] ?? "word";
      const w = plateWidth(text);
      n++;
      return {
        text,
        x: 8 + ((n * 47) % (W - w - 16)),
        y,
        typed: 0,
        tone: n,
        speed: 9 + (n % 3) * 2,
        dying: false,
      };
    };
    let plates: Plate[] = [];
    let sparks: Spark[] = [];
    let shipX = W / 2;
    let bullets: Bullet[] = [];
    let lastType = 0;
    let raf = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      if (dt < 1 / 40) return;
      prev = now;
      const t = now / 1000;

      // simulate: the lowest plate gets one letter (and one bullet) every 0.16s once on screen
      const sy = H - ship.height - 10;
      for (const p of plates) p.y += p.speed * dt;
      const target = plates.filter((p) => !p.dying).sort((a, b) => b.y - a.y)[0];
      if (target && target.y > 18 && t - lastType > 0.16) {
        lastType = t;
        target.typed++;
        target.dying = target.typed >= target.text.length;
        bullets.push({ x: shipX, y: sy - 1, plate: target, final: target.dying });
      }
      const burst = (cx: number, cy: number, cols: string[], count: number, speed: number) => {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const v = speed + (i % 4) * speed * 0.6;
          sparks.push({
            x: cx,
            y: cy,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.45,
            c: cols[i % cols.length] ?? "#fff",
          });
        }
      };
      bullets = bullets.filter((b) => {
        if (!plates.includes(b.plate)) return false;
        const tx = b.plate.x + plateWidth(b.plate.text) / 2;
        const ty = b.plate.y + PLATE_H / 2;
        const d = Math.hypot(tx - b.x, ty - b.y);
        const step = 260 * dt;
        if (d > step) {
          b.x += ((tx - b.x) / d) * step;
          b.y += ((ty - b.y) / d) * step;
          return true;
        }
        if (b.final) {
          burst(tx, ty, ["#fff3cf", "#ffcd75", "#ef7d57", "#f05d6c", "#c6fbff"], 16, 20);
          plates = plates.filter((p) => p !== b.plate);
        } else burst(tx, ty + 4, ["#ffffff", "#73eff7"], 4, 14);
        return false;
      });
      if (plates.length < 3) plates.push(spawn(-PLATE_H - plates.length * 30));
      plates = plates.filter((p) => p.y < H - 30);
      const goal = target ? target.x + plateWidth(target.text) / 2 : W / 2;
      shipX += (goal - shipX) * Math.min(1, dt * 6);

      // draw
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sky, 0, 0);
      drawStars(ctx, stars, t, W, still ? 0 : 0.8);
      ctx.drawImage(planet, W - planet.width + 6, 4);
      // ground strip
      ctx.fillStyle = "#0a0d17";
      ctx.fillRect(0, H - 8, W, 8);
      for (let x = 0; x < W; x += 6) {
        ctx.fillStyle = (x / 6) % 2 ? "#b13e53" : "#f05d6c";
        ctx.fillRect(x, H - 9, 4, 1);
      }
      for (const p of plates)
        paintPlate(
          ctx,
          p.text,
          p.typed,
          p.tone,
          p === target || p.dying,
          Math.round(p.x),
          Math.round(p.y),
        );
      const sx = Math.round(shipX - ship.width / 2);
      for (const b of bullets) {
        const bx = Math.round(b.x);
        const by = Math.round(b.y);
        ctx.fillStyle = "#3b5dc9";
        ctx.fillRect(bx, by + 3, 1, 2);
        ctx.fillStyle = "#73eff7";
        ctx.fillRect(bx - 1, by, 3, 3);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bx, by, 1, 2);
      }
      ctx.drawImage(ship, sx, sy + (Math.floor(t * 4) % 2));
      // engine flicker
      ctx.fillStyle = Math.floor(t * 12) % 2 ? "#ffcd75" : "#ef7d57";
      ctx.fillRect(sx + 9, sy + ship.height, 3, 2);
      for (const s of sparks) s.life -= dt;
      sparks = sparks.filter((s) => s.life > 0);
      for (const s of sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        ctx.fillStyle = s.c;
        const size = s.life > 0.25 ? 2 : 1;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), size, size);
      }
    };

    let cancelled = false;
    document.fonts
      .load(`12px ${WORD_FONT}`)
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        plates = [spawn(70), spawn(30), spawn(-12)];
        if (still) frame(performance.now() + 100);
        else raf = requestAnimationFrame(frame);
        if (still) cancelAnimationFrame(raf);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden="true" className={`h-full ${className}`}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="pixelated block h-full w-auto"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
    </div>
  );
}
