import Phaser from "phaser";
import { toCanvas } from "../../../lib/pixelart";
import { paintPlanet, paintSky } from "../../../lib/sky";
import { getSprite } from "../../../lib/sprites";
import { MEANING_FONT, PLATE_H, paintExplosion, paintPlate, plateWidth, WORD_FONT } from "../art";
import type { GameBus } from "../bus";
import {
  type ActiveWord,
  FIELD_H,
  FIELD_W,
  GROUND_Y,
  type Notice,
  PLAY_W,
  type WordBlasterEngine,
} from "../logic/engine";

/** Game pixels per art pixel: the field is 960×540 but the art is drawn at 480×270. */
const S = 2;
const snap = (v: number) => Math.round(v / S) * S;
const BOOM_FRAMES = 8;
const BOOM_SIZE = 44;
/** The ship hovers just above the shield line, clear of the HUD on the deck. */
const SHIP_Y = GROUND_Y - 34;

const FIRE = [0xfff6c4, 0xffd866, 0xff9d4f, 0xf05d6c, 0xc43356, 0x6fd0ff];
const STAR_COLORS = [0x3a3170, 0x6a5c9e, 0xa99fe0, 0xe6e0ff];

interface WordView {
  img: Phaser.GameObjects.Image;
  tex: Phaser.Textures.CanvasTexture;
  key: string;
  meaning: Phaser.GameObjects.Text;
  typed: number;
  lock: boolean;
  /** plate width in game px */
  w: number;
}

export interface SceneData {
  engine: WordBlasterEngine;
  bus: GameBus;
  showMeaning: boolean;
}

/** Paints the deck under the shield line: metal plates, seams, rivets and window lights. */
function paintGround(w: number, h: number) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const rows = ["#2f5bd0", "#6fd0ff", "#c2f4ff", "#3f8ff0", "#1d3383", "#4a3f7a", "#2b2550"];
  rows.forEach((c, y) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, y, w, 1);
  });
  ctx.fillStyle = "#1a1533";
  ctx.fillRect(0, rows.length, w, h - rows.length);
  for (let y = rows.length; y < h; y++) {
    ctx.fillStyle = y % 2 ? "#17122e" : "#1a1533";
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 40) {
    ctx.fillStyle = "#0c0a1a";
    ctx.fillRect(x, rows.length, 1, h);
    ctx.fillStyle = "#3a3170";
    ctx.fillRect(x + 1, rows.length, 1, h);
    ctx.fillStyle = "#6a5c9e";
    ctx.fillRect(x + 4, rows.length + 3, 1, 1);
    ctx.fillRect(x + 35, rows.length + 3, 1, 1);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = (x / 40 + k) % 3 === 0 ? "#ffd866" : "#2f5bd0";
      ctx.fillRect(x + 12 + k * 6, rows.length + 9, 3, 2);
    }
  }
  return cv;
}

/** Draws the playfield. All rules live in the engine; this class only mirrors its state. */
export class WordBlasterScene extends Phaser.Scene {
  private engine!: WordBlasterEngine;
  private bus!: GameBus;
  private showMeaning = true;
  private views = new Map<number, WordView>();
  private stars: { obj: Phaser.GameObjects.Rectangle; speed: number }[] = [];
  private ship!: Phaser.GameObjects.Image;
  private flame!: Phaser.GameObjects.Rectangle;
  private flameCore!: Phaser.GameObjects.Rectangle;
  private aim!: Phaser.GameObjects.Graphics;
  private shield!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
  private wrongUntil = 0;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super("word-blaster");
  }

  init(data: SceneData) {
    this.engine = data.engine;
    this.bus = data.bus;
    this.showMeaning = data.showMeaning;
  }

  create() {
    this.makeTextures();
    this.cameras.main.setBackgroundColor("#06050d");
    this.add.image(0, 0, "wb-sky").setOrigin(0).setScale(S).setDepth(-10);
    this.add
      .image(FIELD_W - 250, 30, "wb-planet")
      .setOrigin(0)
      .setScale(S)
      .setDepth(-9);
    this.makeStars();

    this.add
      .image(0, GROUND_Y - 2 * S, "wb-ground")
      .setOrigin(0)
      .setScale(S)
      .setDepth(2);
    this.shield = this.add
      .rectangle(0, GROUND_Y - 2 * S, FIELD_W, 3 * S, 0x6fd0ff)
      .setOrigin(0)
      .setAlpha(0.35)
      .setDepth(2);
    this.tweens.add({
      targets: this.shield,
      alpha: 0.12,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Stepped",
      easeParams: [4],
    });

    this.add
      .ellipse(FIELD_W / 2, GROUND_Y - S, 80, 10, 0x6fd0ff, 0.3)
      .setDepth(5)
      .setName("shipGlow");
    this.flame = this.add.rectangle(0, 0, 3 * S, 3 * S, 0xff9d4f).setDepth(5);
    this.flameCore = this.add.rectangle(0, 0, S, 2 * S, 0xfff6c4).setDepth(5);
    this.ship = this.add
      .image(FIELD_W / 2, SHIP_Y, "wb-ship")
      .setScale(S)
      .setDepth(6);

    this.aim = this.add.graphics().setDepth(5);
    this.flash = this.add
      .rectangle(0, 0, FIELD_W, FIELD_H, 0xf05d6c)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(20);

    this.unsubscribe = this.engine.subscribe((n) => this.onNotice(n));
    const onMeaning = (v: boolean) => {
      this.showMeaning = v;
    };
    const onShake = (v: number) => this.cameras.main.shake(120, v);
    this.bus.on("showMeaning", onMeaning);
    this.bus.on("shake", onShake);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.bus.off("showMeaning", onMeaning);
      this.bus.off("shake", onShake);
    });
  }

  update(time: number, delta: number) {
    this.engine.tick();
    this.scrollStars(delta);
    this.syncWords(time);
    this.flyShip(time);
  }

  /* ---------- art ---------- */

  private makeTextures() {
    const t = this.textures;
    if (!t.exists("wb-sky")) t.addCanvas("wb-sky", paintSky(FIELD_W / S, FIELD_H / S, 13));
    if (!t.exists("wb-planet")) t.addCanvas("wb-planet", paintPlanet(30, 4));
    if (!t.exists("wb-ship")) t.addCanvas("wb-ship", toCanvas(getSprite("ship")));
    if (!t.exists("wb-boom")) {
      const tex = t.addCanvas("wb-boom", paintExplosion(BOOM_FRAMES, BOOM_SIZE));
      for (let i = 0; i < BOOM_FRAMES; i++) tex?.add(i, 0, i * BOOM_SIZE, 0, BOOM_SIZE, BOOM_SIZE);
    }
    if (!t.exists("wb-ground"))
      t.addCanvas("wb-ground", paintGround(FIELD_W / S, (FIELD_H - GROUND_Y) / S + 2));
  }

  private makeStars() {
    const rnd = new Phaser.Math.RandomDataGenerator(["lexi-stars"]);
    for (let i = 0; i < 110; i++) {
      const depth = i < 60 ? 0 : i < 95 ? 1 : 2;
      const obj = this.add
        .rectangle(
          snap(rnd.between(0, FIELD_W)),
          snap(rnd.between(0, GROUND_Y)),
          S,
          depth === 2 ? S * 2 : S,
          STAR_COLORS[depth + rnd.between(0, 1)] ?? 0xffffff,
        )
        .setOrigin(0)
        .setDepth(-8);
      this.stars.push({ obj, speed: [6, 16, 40][depth] ?? 6 });
    }
  }

  private scrollStars(delta: number) {
    for (const s of this.stars) {
      s.obj.y += (s.speed * delta) / 1000;
      if (s.obj.y > GROUND_Y) {
        s.obj.y = -4;
        s.obj.x = snap(Phaser.Math.Between(0, FIELD_W));
      }
    }
  }

  private flyShip(time: number) {
    const tg = this.engine.target;
    const goal = tg ? Phaser.Math.Clamp(tg.x, 40, PLAY_W) : PLAY_W / 2;
    const x = this.ship.x + (goal - this.ship.x) * 0.2;
    this.ship.x = x;
    const bob = Math.floor(time / 250) % 2 ? S : 0;
    this.ship.y = SHIP_Y + bob;
    const sx = snap(x);
    const tail = this.ship.y + this.ship.displayHeight / 2;
    const flicker = Math.floor(time / 60) % 2;
    this.flame
      .setPosition(sx, tail + S * (flicker ? 2 : 1))
      .setSize(3 * S, (flicker ? 4 : 3) * S)
      .setFillStyle(flicker ? 0xff9d4f : 0xffd866);
    this.flameCore.setPosition(sx, tail + S);
    const glow = this.children.getByName("shipGlow") as Phaser.GameObjects.Ellipse | null;
    glow?.setPosition(sx, GROUND_Y - S);
  }

  /* ---------- falling words ---------- */

  private makeView(w: ActiveWord): WordView {
    const key = `wb-word-${w.uid}`;
    const width = plateWidth(w.word.lemma);
    const cv = document.createElement("canvas");
    cv.width = width;
    cv.height = PLATE_H;
    const tex = this.textures.addCanvas(key, cv) as Phaser.Textures.CanvasTexture;
    paintPlate(tex.context, w.word.lemma, 0, w.uid, false);
    tex.refresh();
    const img = this.add.image(0, 0, key).setScale(S).setDepth(3);
    const meaning = this.add
      .text(0, 0, w.word.meaningVi, {
        fontFamily: MEANING_FONT,
        fontSize: "12px",
        color: "#cfc8ef",
      })
      .setOrigin(0.5, 0)
      .setScale(S)
      .setDepth(4)
      .setShadow(1, 1, "#0c0a1a", 0, false, true);
    return { img, tex, key, meaning, typed: 0, lock: false, w: width * S };
  }

  private syncWords(time: number) {
    const live = new Set<number>();
    const tg = this.engine.target;
    const shake = time < this.wrongUntil ? (Math.floor(time / 30) % 2 ? S : -S) : 0;
    for (const w of this.engine.active) {
      live.add(w.uid);
      let v = this.views.get(w.uid);
      if (!v) {
        v = this.makeView(w);
        this.views.set(w.uid, v);
      }
      const lock = tg?.uid === w.uid;
      if (v.typed !== w.typed || v.lock !== lock) {
        v.typed = w.typed;
        v.lock = lock;
        v.tex.context.clearRect(0, 0, v.tex.width, v.tex.height);
        paintPlate(v.tex.context, w.word.lemma, w.typed, w.uid, lock);
        v.tex.refresh();
      }
      const half = v.w / 2;
      const cx = snap(Phaser.Math.Clamp(w.x, half + 8, PLAY_W - half + 8)) + (lock ? shake : 0);
      const cy = snap(w.y + PLATE_H);
      v.img.setPosition(cx, cy);
      v.meaning.setVisible(this.showMeaning).setPosition(cx, cy + PLATE_H + S * 2);
    }
    for (const [uid, v] of this.views) {
      if (!live.has(uid)) {
        this.destroyView(v);
        this.views.delete(uid);
      }
    }

    // dotted aiming line + lock-on brackets
    this.aim.clear();
    const v = tg && this.views.get(tg.uid);
    if (!v) return;
    const top = v.img.y - PLATE_H;
    const bottom = v.img.y + PLATE_H;
    const left = v.img.x - v.w / 2;
    const right = v.img.x + v.w / 2;
    this.aim.fillStyle(0x6fd0ff, 0.45);
    for (let y = bottom + 6; y < this.ship.y - 24; y += 10)
      this.aim.fillRect(snap(v.img.x) - 1, y, S, 6);
    const pulse = Math.floor(time / 160) % 2 ? 2 * S : 3 * S;
    const L = 5 * S;
    this.aim.fillStyle(0xffd866, 1);
    for (const [x, y, dx, dy] of [
      [left - pulse, top - pulse, 1, 1],
      [right + pulse, top - pulse, -1, 1],
      [left - pulse, bottom + pulse, 1, -1],
      [right + pulse, bottom + pulse, -1, -1],
    ] as const) {
      this.aim.fillRect(dx > 0 ? x : x - L, dy > 0 ? y : y - S, L, S);
      this.aim.fillRect(dx > 0 ? x : x - S, dy > 0 ? y : y - L, S, L);
    }
  }

  private destroyView(v: WordView) {
    v.img.destroy();
    v.meaning.destroy();
    this.textures.remove(v.key);
  }

  /* ---------- feedback ---------- */

  private onNotice(n: Notice) {
    if (n.kind === "hit") this.playHit(n.word, n.points);
    else if (n.kind === "miss") this.playMiss(n.word);
    else if (n.kind === "wrong") {
      this.wrongUntil = this.time.now + 160;
      this.cameras.main.shake(80, 0.002);
    }
  }

  private burst(x: number, y: number, colors: number[], count: number, spread: number) {
    for (let i = 0; i < count; i++) {
      const size = (i % 3 === 0 ? 2 : 1) * S;
      const p = this.add
        .rectangle(x, y, size, size, colors[i % colors.length] ?? 0xffffff)
        .setDepth(8);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = spread * (0.5 + Math.random() * 0.7);
      this.tweens.add({
        targets: p,
        x: snap(x + Math.cos(angle) * dist),
        y: snap(y + Math.sin(angle) * dist + 18),
        alpha: { from: 1, to: 0, ease: "Stepped", easeParams: [3] },
        duration: 480 + Math.random() * 320,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Plays the pixel explosion strip by stepping frames (no tweened scaling, stays crisp). */
  private explode(x: number, y: number) {
    const boom = this.add.image(snap(x), snap(y), "wb-boom", 0).setScale(S).setDepth(8);
    let f = 0;
    this.time.addEvent({
      delay: 45,
      repeat: BOOM_FRAMES - 1,
      callback: () => {
        f++;
        if (f >= BOOM_FRAMES) boom.destroy();
        else boom.setFrame(f);
      },
    });
  }

  private playHit(word: ActiveWord, points: number) {
    const v = this.views.get(word.uid);
    const x = v?.img.x ?? word.x;
    const y = v?.img.y ?? word.y;
    const nose = this.ship.y - 20;

    const beam = this.add
      .rectangle(snap(x), nose, 3 * S, nose - y, 0x6fd0ff)
      .setOrigin(0.5, 1)
      .setDepth(7);
    const core = this.add
      .rectangle(snap(x), nose, S, nose - y, 0xffffff)
      .setOrigin(0.5, 1)
      .setDepth(7);
    this.tweens.add({
      targets: [beam, core],
      alpha: 0,
      scaleX: 0.3,
      duration: 200,
      ease: "Stepped",
      easeParams: [4],
      onComplete: () => {
        beam.destroy();
        core.destroy();
      },
    });

    this.explode(x, y);
    this.burst(x, y, FIRE, 22, 70);

    const label = this.add
      .text(x + 12, y - 30, `+${points}`, {
        fontFamily: WORD_FONT,
        fontSize: "12px",
        color: "#b4f57a",
      })
      .setScale(S)
      .setShadow(1, 1, "#0c0a1a", 0, false, true)
      .setDepth(9);
    this.tweens.add({
      targets: label,
      y: y - 76,
      alpha: 0,
      duration: 760,
      ease: "Stepped",
      easeParams: [8],
      onComplete: () => label.destroy(),
    });
  }

  private playMiss(word: ActiveWord) {
    this.flash.setAlpha(0.32);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 280 });
    this.cameras.main.shake(200, 0.007);
    this.shield.setFillStyle(0xf05d6c).setAlpha(0.8);
    this.time.delayedCall(260, () => this.shield.setFillStyle(0x6fd0ff));
    const x = Phaser.Math.Clamp(word.x, 30, FIELD_W - 30);
    this.burst(x, GROUND_Y, [0xf05d6c, 0xc43356, 0xff9d4f, 0x7a1d3f], 14, 50);
    this.explode(x, GROUND_Y - 6);
  }
}
