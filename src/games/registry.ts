import type { GameId } from "@shared/games";

export interface GameEntry {
  id: string;
  title: string;
  tag: string;
  desc: string;
  glyph: string;
  accent: string;
  path: string | null;
  unlockLevel: number;
  /** playable games: text for the map page */
  map?: { subtitle: string; note: string; hasDifficulty: boolean; startLabel: string };
}

/** Every game the hub knows about. `path: null` renders as "Sắp ra mắt". */
export const GAMES: GameEntry[] = [
  {
    id: "word-blaster",
    title: "WORD BLASTER",
    tag: "GAME 01 · GÕ PHÍM",
    desc: "Đọc nghĩa tiếng Việt, rồi gõ đúng từ tiếng Anh trong các đáp án đang rơi để bắn hạ trước khi chạm đất. Luyện tốc độ gõ và nhớ nghĩa từ cùng lúc.",
    glyph: "WB",
    accent: "#ffc175",
    path: "/games/word-blaster",
    unlockLevel: 1,
    map: {
      subtitle: "Đọc nghĩa tiếng Việt, gõ đúng đáp án tiếng Anh đang rơi",
      note: "Mỗi mốc gồm khoảng 12 từ. Đạt 1 sao để mở mốc tiếp theo.",
      hasDifficulty: true,
      startLabel: "Bắt đầu",
    },
  },
  {
    id: "ghost-race",
    title: "GHOST RACE",
    tag: "GAME 02 · ĐUA GÕ PHÍM",
    desc: "Gõ từ tiếng Anh theo nghĩa để xe chạy về đích, đua với bóng ma kỷ lục của chính bạn và người nhanh nhất mốc.",
    glyph: "GR",
    accent: "#73eff7",
    path: "/games/ghost-race",
    unlockLevel: 1,
    map: {
      subtitle: "Gõ từ theo nghĩa, đua với bóng ma kỷ lục",
      note: "Về đích là 1 sao, thắng xe mốc là 2 sao, thắng xe mốc với 95% chính xác là 3 sao.",
      hasDifficulty: true,
      startLabel: "Xuất phát",
    },
  },
  {
    id: "sentence-express",
    title: "SENTENCE EXPRESS",
    tag: "GAME 03 · XẾP CÂU",
    desc: "Chất các toa chữ theo đúng thứ tự để thành câu tiếng Anh hoàn chỉnh. Chọn bộ A1–B2 và săn điểm cao trước khi hết giờ.",
    glyph: "ABC",
    accent: "#a7f070",
    path: "/games/sentence-express",
    unlockLevel: 1,
    map: {
      subtitle: "Chọn bộ từ, xếp càng nhiều câu càng tốt trước khi hết giờ",
      note: "Chơi theo bộ từ, không theo mốc.",
      hasDifficulty: false,
      startLabel: "Lên tàu",
    },
  },
  {
    id: "word-match",
    title: "WORD MATCH",
    tag: "SẮP RA MẮT",
    desc: "Lật thẻ, ghép từ tiếng Anh với nghĩa tiếng Việt.",
    glyph: "A=B",
    accent: "#a7f070",
    path: null,
    unlockLevel: 15,
  },
  {
    id: "spell-dungeon",
    title: "SPELL DUNGEON",
    tag: "SẮP RA MẮT",
    desc: "Đánh vần đúng để mở cửa hầm ngục.",
    glyph: "ABC",
    accent: "#ef7d57",
    path: null,
    unlockLevel: 20,
  },
  {
    id: "listen-quest",
    title: "LISTEN QUEST",
    tag: "SẮP RA MẮT",
    desc: "Nghe phát âm và chọn từ đúng.",
    glyph: "))))",
    accent: "#73eff7",
    path: null,
    unlockLevel: 25,
  },
];

export function gameById(id: string | undefined): (GameEntry & { id: GameId }) | undefined {
  return GAMES.find((g) => g.id === id && g.path) as (GameEntry & { id: GameId }) | undefined;
}
