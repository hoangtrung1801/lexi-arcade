import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { MEANING_FONT, WORD_FONT } from "../art";
import type { GameBus } from "../bus";
import { FIELD_H, FIELD_W, type WordBlasterEngine } from "../logic/engine";
import { WordBlasterScene } from "./scene";

interface Props {
  engine: WordBlasterEngine;
  bus: GameBus;
  showMeaning: boolean;
}

/**
 * Owns the Phaser.Game instance. Created in an effect and destroyed on cleanup, so it survives
 * React StrictMode mounting effects twice in development.
 */
export function GameHost({ engine, bus, showMeaning }: Props) {
  const parent = useRef<HTMLDivElement>(null);
  const meaning = useRef(showMeaning);
  meaning.current = showMeaning;

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;

    const boot = async () => {
      try {
        await Promise.all([
          document.fonts.load(`12px ${WORD_FONT}`),
          document.fonts.load(`12px ${MEANING_FONT}`),
        ]);
      } catch {}
      if (cancelled || !parent.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: parent.current,
        width: FIELD_W,
        height: FIELD_H,
        pixelArt: true,
        roundPixels: true,
        backgroundColor: "#06050d",
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [],
        audio: { noAudio: true },
      });
      game.scene.add("word-blaster", WordBlasterScene, true, {
        engine,
        bus,
        showMeaning: meaning.current,
      });
    };
    boot();

    return () => {
      cancelled = true;
      game?.destroy(true);
      game = null;
    };
  }, [engine, bus]);

  useEffect(() => {
    bus.emit("showMeaning", showMeaning);
  }, [bus, showMeaning]);

  return <div ref={parent} className="h-full w-full" data-testid="phaser-parent" />;
}
