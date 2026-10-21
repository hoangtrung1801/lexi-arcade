import mitt from "mitt";

/**
 * Typed bridge between React and the Phaser scene.
 * Game state itself flows through the engine's notices; the bus only carries UI -> scene commands.
 */
export type GameBusEvents = {
  showMeaning: boolean;
  shake: number;
};

export type GameBus = ReturnType<typeof createGameBus>;
export const createGameBus = () => mitt<GameBusEvents>();
