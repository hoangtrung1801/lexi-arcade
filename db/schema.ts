import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* ---------- Better Auth core tables ---------- */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

/* ---------- App tables ---------- */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  avatarId: text("avatar_id"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  coins: integer("coins").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  settingsJson: text("settings_json").notNull().default("{}"),
});

export const wordSets = sqliteTable("word_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  cefr: text("cefr").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const units = sqliteTable(
  "units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    setId: integer("set_id")
      .notNull()
      .references(() => wordSets.id),
    idx: integer("idx").notNull(),
    titleVi: text("title_vi").notNull(),
    topic: text("topic"),
    wordCount: integer("word_count").notNull().default(0),
  },
  (t) => [index("units_set_idx").on(t.setId, t.idx)],
);

export const words = sqliteTable(
  "words",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    lemma: text("lemma").notNull(),
    pos: text("pos"),
    ipa: text("ipa"),
    meaningVi: text("meaning_vi").notNull(),
    exampleEn: text("example_en"),
    cefr: text("cefr").notNull(),
    audioKey: text("audio_key"),
    source: text("source"),
    reviewed: integer("reviewed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("words_lemma_idx").on(t.lemma)],
);

export const unitWords = sqliteTable(
  "unit_words",
  {
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.unitId, t.wordId] })],
);

export const userUnitProgress = sqliteTable(
  "user_unit_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id),
    bestStars: integer("best_stars").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
    bestWpm: real("best_wpm").notNull().default(0),
    plays: integer("plays").notNull().default(0),
    completedAt: integer("completed_at"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.unitId] })],
);

export const userWordProgress = sqliteTable(
  "user_word_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id),
    box: integer("box").notNull().default(0),
    dueAt: integer("due_at").notNull().default(0),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
    lastSeenAt: integer("last_seen_at").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.wordId] }),
    index("uwp_user_due_idx").on(t.userId, t.dueAt),
  ],
);

export const userSavedWords = sqliteTable(
  "user_saved_words",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => words.id),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.wordId] })],
);

export const gameSessions = sqliteTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    unitId: integer("unit_id")
      .notNull()
      .references(() => units.id),
    difficulty: text("difficulty").notNull(),
    seed: integer("seed").notNull(),
    wordIdsJson: text("word_ids_json").notNull(),
    status: text("status").notNull().default("started"), // started | finished | rejected
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    score: integer("score"),
    wpm: real("wpm"),
    accuracy: real("accuracy"),
    maxCombo: integer("max_combo"),
    stars: integer("stars"),
    xpGained: integer("xp_gained"),
    coinsGained: integer("coins_gained"),
    rejectReason: text("reject_reason"),
  },
  (t) => [index("gs_user_started_idx").on(t.userId, t.startedAt)],
);

export const dailyQuests = sqliteTable(
  "daily_quests",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    questKey: text("quest_key").notNull(),
    progress: integer("progress").notNull().default(0),
    target: integer("target").notNull(),
    claimed: integer("claimed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.questKey] })],
);

export const weeklyScores = sqliteTable(
  "weekly_scores",
  {
    week: text("week").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    score: integer("score").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.week, t.userId, t.gameId] }),
    index("ws_rank_idx").on(t.week, t.gameId, t.score),
  ],
);
