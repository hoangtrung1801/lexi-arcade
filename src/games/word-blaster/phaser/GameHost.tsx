import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { WORD_FONT } from "../art";
import type { GameBus } from "../bus";
import { FIELD_H, FIELD_W, type WordBlasterEngine } from "../logic/engine";
import { WordBlasterScene } from "./scene";

interface Props {
  engine: WordBlasterEngine;
  bus: GameBus;
}

/**
 * Owns the Phaser.Game instance. Created in an effect and destroyed on cleanup, so it survives
 * React StrictMode mounting effects twice in development.
 */
export function GameHost({ engine, bus }: Props) {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;

    const boot = async () => {
      try {
        await Promise.all([document.fonts.load(`12px ${WORD_FONT}`)]);
      } catch {}
      if (cancelled || !parent.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parent.current,
        width: FIELD_W,
        height: FIELD_H,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: "#0a0b14",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [],
        audio: { noAudio: true },
      });
      game.scene.add("word-blaster", WordBlasterScene, true, { engine, bus });
    };
    boot();

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = null;
    };
  }, [engine, bus]);

  return <div ref={parent} className="absolute inset-0" data-testid="phaser-parent" />;
}
