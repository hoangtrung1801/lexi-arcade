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
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

/** Self-playing miniature of the game for the hub card (decorative). */
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
      };
    };
    let plates: Plate[] = [];
    let sparks: Spark[] = [];
    let shipX = W / 2;
    let beam = 0;
    let beamX = 0;
    let beamY = 0;
    let lastType = 0;
    let raf = 0;
    let prev = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      if (dt < 1 / 40) return;
      prev = now;
      const t = now / 1000;

      // simulate: the lowest plate gets typed one letter every 0.16s once it is on screen
      for (const p of plates) p.y += p.speed * dt;
      const target = [...plates].sort((a, b) => b.y - a.y)[0];
      if (target && target.y > 18 && t - lastType > 0.16) {
        lastType = t;
        target.typed++;
        if (target.typed >= target.text.length) {
          const cx = target.x + plateWidth(target.text) / 2;
          const cy = target.y + PLATE_H / 2;
          beam = 0.12;
          beamX = cx;
          beamY = cy;
          const cols = ["#fff6c4", "#ffd866", "#ff9d4f", "#f05d6c", "#c2f4ff"];
          for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const v = 20 + (i % 4) * 12;
            sparks.push({
              x: cx,
              y: cy,
              vx: Math.cos(a) * v,
              vy: Math.sin(a) * v,
              life: 0.45,
              c: cols[i % cols.length] ?? "#fff",
            });
          }
          plates = plates.filter((p) => p !== target);
        }
      }
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
      ctx.fillStyle = "#0a0819";
      ctx.fillRect(0, H - 8, W, 8);
      for (let x = 0; x < W; x += 6) {
        ctx.fillStyle = (x / 6) % 2 ? "#c43356" : "#f05d6c";
        ctx.fillRect(x, H - 9, 4, 1);
      }
      for (const p of plates)
        paintPlate(ctx, p.text, p.typed, p.tone, p === target, Math.round(p.x), Math.round(p.y));
      const sy = H - ship.height - 10;
      const sx = Math.round(shipX - ship.width / 2);
      if (target) {
        ctx.fillStyle = "rgba(111,208,255,0.35)";
        for (let y = Math.round(target.y + PLATE_H); y < sy; y += 3) {
          ctx.fillRect(Math.round(goal), y, 1, 2);
        }
      }
      if (beam > 0) {
        beam -= dt;
        ctx.fillStyle = "#6fd0ff";
        ctx.fillRect(Math.round(beamX) - 1, Math.round(beamY), 3, sy - beamY);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(beamX), Math.round(beamY), 1, sy - beamY);
      }
      ctx.drawImage(ship, sx, sy + (Math.floor(t * 4) % 2));
      // engine flicker
      ctx.fillStyle = Math.floor(t * 12) % 2 ? "#ffd866" : "#ff9d4f";
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
    <div aria-hidden="true" className={className}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="pixelated block"
        style={{ width: W * 2, height: H * 2 }}
      />
    </div>
  );
}
