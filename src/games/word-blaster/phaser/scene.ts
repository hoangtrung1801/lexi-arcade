import Phaser from "phaser";
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

const WORD_COLORS = [0x5d275d, 0x38b764, 0x257179, 0x3b5dc9, 0xb13e53, 0x29366f];
const PX_FONT = '"Press Start 2P", monospace';
const BODY_FONT = "VT323, monospace";

interface WordView {
  box: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  typed: Phaser.GameObjects.Text;
  rest: Phaser.GameObjects.Text;
  meaning: Phaser.GameObjects.Text;
  lastTyped: number;
  w: number;
}

export interface SceneData {
  engine: WordBlasterEngine;
  bus: GameBus;
  showMeaning: boolean;
}

/** Draws the playfield. All rules live in the engine; this class only mirrors its state. */
export class WordBlasterScene extends Phaser.Scene {
  private engine!: WordBlasterEngine;
  private bus!: GameBus;
  private showMeaning = true;
  private views = new Map<number, WordView>();
  private starLayers: { rect: Phaser.GameObjects.Rectangle; speed: number }[] = [];
  private ship!: Phaser.GameObjects.Container;
  private laser!: Phaser.GameObjects.Rectangle;
  private flash!: Phaser.GameObjects.Rectangle;
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
    this.cameras.main.setBackgroundColor("#1a1c2c");
    this.drawBackground();
    this.drawGround();
    this.buildShip();

    this.laser = this.add.rectangle(0, 0, 4, 4, 0x73eff7).setOrigin(0.5, 1).setAlpha(0).setDepth(5);
    this.flash = this.add
      .rectangle(FIELD_W / 2, FIELD_H / 2, FIELD_W, FIELD_H, 0xb13e53)
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

  update(_time: number, delta: number) {
    this.engine.tick();
    this.scrollStars(delta);
    this.syncWords();
    this.aimShip();
  }

  /* ---------- static art (placeholder rectangles, same grid as the planned sprites) ---------- */

  private drawBackground() {
    const bands = 18;
    const from = Phaser.Display.Color.ValueToColor(0x1a1c2c);
    const to = Phaser.Display.Color.ValueToColor(0x29366f);
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, bands - 1, i);
      this.add
        .rectangle(
          0,
          (i * FIELD_H) / bands,
          FIELD_W,
          FIELD_H / bands + 1,
          Phaser.Display.Color.GetColor(c.r, c.g, c.b),
        )
        .setOrigin(0, 0)
        .setDepth(-10);
    }
    // planet
    this.add.rectangle(FIELD_W - 150, 90, 64, 64, 0xef7d57).setDepth(-9);
    this.add
      .rectangle(FIELD_W - 150 + 8, 90 + 8, 48, 48, 0xb13e53)
      .setDepth(-9)
      .setAlpha(0.6);
    this.add.rectangle(FIELD_W - 170, 72, 18, 14, 0xffcd75).setDepth(-9);

    const rnd = new Phaser.Math.RandomDataGenerator(["lexi-stars"]);
    for (let i = 0; i < 70; i++) {
      const far = i < 45;
      const size = far ? 2 : 4;
      const rect = this.add
        .rectangle(
          rnd.between(0, FIELD_W),
          rnd.between(0, FIELD_H),
          size,
          size,
          far ? 0x94b0c2 : 0xf4f4f4,
        )
        .setAlpha(far ? 0.45 : 0.8)
        .setDepth(-8);
      this.starLayers.push({ rect, speed: far ? 8 : 20 });
    }
  }

  private drawGround() {
    for (let x = 0; x < FIELD_W; x += 24) {
      this.add
        .rectangle(x, GROUND_Y + 4, 16, 6, 0xb13e53)
        .setOrigin(0, 0)
        .setDepth(2);
      this.add
        .rectangle(x + 16, GROUND_Y + 4, 8, 6, 0x5d275d)
        .setOrigin(0, 0)
        .setDepth(2);
    }
    this.add
      .rectangle(0, GROUND_Y + 10, FIELD_W, FIELD_H - GROUND_Y, 0x0d0e18)
      .setOrigin(0, 0)
      .setDepth(1);
  }

  private buildShip() {
    const px = 4;
    const rects: [number, number, number, number, number][] = [
      [5, 0, 2, 2, 0x73eff7],
      [4, 2, 4, 5, 0x41a6f6],
      [5, 3, 2, 2, 0xffcd75],
      [2, 6, 8, 3, 0x3b5dc9],
      [0, 8, 3, 2, 0x29366f],
      [9, 8, 3, 2, 0x29366f],
      [4, 9, 4, 1, 0x3b5dc9],
      [5, 10, 2, 2, 0xef7d57],
    ];
    const parts = rects.map(([x, y, w, h, c]) =>
      this.add.rectangle((x - 6) * px, (y - 6) * px, w * px, h * px, c).setOrigin(0, 0),
    );
    this.ship = this.add.container(FIELD_W / 2, FIELD_H - 34, parts).setDepth(6);
  }

  private scrollStars(delta: number) {
    for (const s of this.starLayers) {
      s.rect.y += (s.speed * delta) / 1000;
      if (s.rect.y > FIELD_H) {
        s.rect.y = -4;
        s.rect.x = Phaser.Math.Between(0, FIELD_W);
      }
    }
  }

  private aimShip() {
    const tg = this.engine.target;
    const goal = tg ? Phaser.Math.Clamp(tg.x, 40, PLAY_W) : PLAY_W / 2;
    this.ship.x += (goal - this.ship.x) * 0.2;
  }

  /* ---------- falling words ---------- */

  private makeView(w: ActiveWord): WordView {
    const color = WORD_COLORS[w.uid % WORD_COLORS.length] ?? 0x3b5dc9;
    const style = { fontFamily: PX_FONT, fontSize: "16px", color: "#f4f4f4" };
    const rest = this.add.text(0, 0, w.word.lemma, style).setOrigin(0, 0.5).setDepth(4);
    const typed = this.add
      .text(0, 0, "", { ...style, color: "#ffcd75" })
      .setOrigin(0, 0.5)
      .setDepth(4);
    const width = rest.width + 24;
    const box = this.add.rectangle(0, 0, width, 36, color).setDepth(3);
    const outline = this.add.rectangle(0, 0, width + 8, 44, 0x0d0e18).setDepth(2);
    const meaning = this.add
      .text(0, 0, w.word.meaningVi, { fontFamily: BODY_FONT, fontSize: "22px", color: "#c8d6e0" })
      .setOrigin(0.5, 0)
      .setDepth(4)
      .setShadow(2, 2, "#0d0e18", 0, false, true);
    return { box, outline, typed, rest, meaning, lastTyped: 0, w: width };
  }

  private syncWords() {
    const live = new Set<number>();
    for (const w of this.engine.active) {
      live.add(w.uid);
      let v = this.views.get(w.uid);
      if (!v) {
        v = this.makeView(w);
        this.views.set(w.uid, v);
      }
      const half = v.w / 2;
      const cx = Phaser.Math.Clamp(w.x, half + 8, PLAY_W - half + 8);
      const cy = w.y + 18;
      const isTarget = this.engine.target?.uid === w.uid;
      v.box.setPosition(Math.round(cx), Math.round(cy));
      v.outline
        .setPosition(Math.round(cx), Math.round(cy))
        .setFillStyle(isTarget ? 0xffcd75 : 0x0d0e18);
      const left = Math.round(cx - v.w / 2 + 12);
      v.typed.setPosition(left, Math.round(cy));
      if (v.lastTyped !== w.typed) {
        v.typed.setText(w.word.lemma.slice(0, w.typed));
        v.rest.setText(w.word.lemma.slice(w.typed));
        v.lastTyped = w.typed;
      }
      v.rest.setPosition(left + v.typed.width, Math.round(cy));
      v.meaning.setVisible(this.showMeaning).setPosition(Math.round(cx), Math.round(cy + 26));
    }
    for (const [uid, v] of this.views) {
      if (!live.has(uid)) {
        this.destroyView(v);
        this.views.delete(uid);
      }
    }

    // aiming line from ship to the locked word
    const tg = this.engine.target;
    if (tg) {
      const v = this.views.get(tg.uid);
      if (v) {
        const height = Math.max(8, this.ship.y - 20 - v.box.y);
        this.laser
          .setPosition(v.box.x, this.ship.y - 20)
          .setSize(2, height)
          .setAlpha(0.35);
      }
    } else {
      this.laser.setAlpha(0);
    }
  }

  private destroyView(v: WordView) {
    v.box.destroy();
    v.outline.destroy();
    v.typed.destroy();
    v.rest.destroy();
    v.meaning.destroy();
  }

  /* ---------- feedback ---------- */

  private onNotice(n: Notice) {
    if (n.kind === "hit") this.playHit(n.word, n.points);
    else if (n.kind === "miss") this.playMiss(n.word);
    else if (n.kind === "wrong") this.cameras.main.shake(80, 0.002);
  }

  private playHit(word: ActiveWord, points: number) {
    const v = this.views.get(word.uid);
    const x = v?.box.x ?? word.x;
    const y = v?.box.y ?? word.y;

    const beam = this.add
      .rectangle(x, this.ship.y - 20, 6, this.ship.y - 20 - y, 0x73eff7)
      .setOrigin(0.5, 1)
      .setDepth(7);
    this.tweens.add({ targets: beam, alpha: 0, duration: 140, onComplete: () => beam.destroy() });

    const colors = [0xffcd75, 0xef7d57, 0xf4f4f4, 0xb13e53];
    for (let i = 0; i < 12; i++) {
      const size = Phaser.Math.Between(6, 12);
      const p = this.add
        .rectangle(x, y, size, size, colors[i % colors.length] ?? 0xffcd75)
        .setDepth(8);
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
      const dist = Phaser.Math.Between(30, 70);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 380,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
    const label = this.add
      .text(x + 10, y - 20, `+${points}`, {
        fontFamily: PX_FONT,
        fontSize: "12px",
        color: "#a7f070",
      })
      .setDepth(9);
    this.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 0,
      duration: 700,
      onComplete: () => label.destroy(),
    });
  }

  private playMiss(word: ActiveWord) {
    this.flash.setAlpha(0.35);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
    this.cameras.main.shake(180, 0.006);
    const x = Phaser.Math.Clamp(word.x, 30, FIELD_W - 30);
    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(x, GROUND_Y, 8, 8, 0xb13e53).setDepth(8);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-50, 50),
        y: GROUND_Y - Phaser.Math.Between(20, 60),
        alpha: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }
  }
}
