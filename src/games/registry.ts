export interface GameEntry {
  id: string;
  title: string;
  tag: string;
  desc: string;
  glyph: string;
  accent: string;
  path: string | null;
  unlockLevel: number;
}

/** Every game the hub knows about. `path: null` renders as "Sắp ra mắt". */
export const GAMES: GameEntry[] = [
  {
    id: "word-blaster",
    title: "WORD BLASTER",
    tag: "GAME 01 · GÕ PHÍM",
    desc: "Gõ đúng từ tiếng Anh đang rơi để bắn hạ chúng trước khi chạm mặt đất. Luyện tốc độ gõ và nhớ nghĩa từ cùng lúc.",
    glyph: "WB",
    accent: "#ffcd75",
    path: "/games/word-blaster",
    unlockLevel: 1,
  },
  {
    id: "word-match",
    title: "WORD MATCH",
    tag: "GAME 02",
    desc: "Lật thẻ, ghép từ tiếng Anh với nghĩa tiếng Việt.",
    glyph: "A=B",
    accent: "#a7f070",
    path: null,
    unlockLevel: 15,
  },
  {
    id: "spell-dungeon",
    title: "SPELL DUNGEON",
    tag: "GAME 03",
    desc: "Đánh vần đúng để mở cửa hầm ngục.",
    glyph: "ABC",
    accent: "#ef7d57",
    path: null,
    unlockLevel: 20,
  },
  {
    id: "listen-quest",
    title: "LISTEN QUEST",
    tag: "GAME 04",
    desc: "Nghe phát âm và chọn từ đúng.",
    glyph: "))))",
    accent: "#73eff7",
    path: null,
    unlockLevel: 25,
  },
];
