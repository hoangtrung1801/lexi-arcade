/**
 * Integration tests against a running dev/preview server (default http://localhost:5173).
 * Skipped automatically when the server is not reachable.
 * Needs DEV_LOGIN=true in .dev.vars and a seeded local D1 (pnpm db:migrate:local && pnpm content:seed).
 */

import type {
  FinishSessionResponse,
  LeaderboardResponse,
  MeResponse,
  QuestsResponse,
  StartSessionResponse,
  TrainSetsResponse,
  UnitsResponse,
  VocabResponse,
} from "@shared/api";
import { sentenceParts } from "@shared/sentence";
import type { GameEvent, GameWord, RaceEvent, TrainEvent } from "@shared/types";
import { describe, expect, it } from "vitest";

const BASE = process.env.API_BASE ?? "http://localhost:5173";
const up = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) })
  .then((r) => r.ok)
  .catch(() => false);

class Client {
  cookie = "";
  async req<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
    // The local Vite/miniflare proxy occasionally drops a keep-alive connection ("fetch failed" -> HTML 500).
    // That is a dev-server transport flake, not an app error, so retry those a couple of times.
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(BASE + path, {
        method,
        headers: {
          "content-type": "application/json",
          ...(this.cookie ? { cookie: this.cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const set = res.headers.get("set-cookie");
      if (set) this.cookie = set.split(";")[0] ?? "";
      const text = await res.text();
      try {
        return { status: res.status, json: JSON.parse(text) as T };
      } catch {
        if (attempt < 2) continue;
        throw new Error(`${method} ${path} -> ${res.status} non-JSON: ${text.slice(0, 200)}`);
      }
    }
  }
}

/** Perfect typing of every word, 180ms per key. */
function perfectRun(words: GameWord[]): GameEvent[] {
  const events: GameEvent[] = [];
  let t = 1500;
  for (const w of words) {
    for (let i = 0; i < w.lemma.length; i++) {
      events.push({ t, type: "correct", wordId: w.id });
      t += 180;
    }
    events.push({ t, type: "hit", wordId: w.id });
    t += 400;
  }
  return events;
}

describe("api", () => {
  it.skipIf(!up)("serves public content to guests but locks units after the third", async () => {
    const c = new Client();
    const units = await c.req<UnitsResponse>("GET", "/api/sets/a1/units");
    expect(units.json.units[0]?.state).toBe("open");
    expect(units.json.units[2]?.state).toBe("open");
    expect(units.json.units[3]?.state).toBe("locked");
    expect(units.json.units[3]?.guestLocked).toBe(true);

    const first = units.json.units[0];
    const open = await c.req<{ words: GameWord[] }>("GET", `/api/units/${first?.id}/words`);
    expect(open.status).toBe(200);
    expect(open.json.words.length).toBeGreaterThan(5);

    const locked = await c.req("GET", `/api/units/${units.json.units[3]?.id}/words`);
    expect(locked.status).toBe(401);
  });

  it.skipIf(!up)("guests cannot start sessions or read vocab", async () => {
    const c = new Client();
    expect(
      (await c.req("POST", "/api/sessions", { unitId: 1001, difficulty: "easy" })).status,
    ).toBe(401);
    expect((await c.req("GET", "/api/vocab")).status).toBe(401);
    const me = await c.req<MeResponse>("GET", "/api/me");
    expect(me.json.user).toBeNull();
  });

  it.skipIf(!up)("plays a full round, saves rewards, unlocks the next unit", async () => {
    const c = new Client();
    const name = `Tester${Date.now() % 100000}`;
    expect((await c.req("POST", "/api/dev/login", { name })).status).toBe(200);

    const before = await c.req<MeResponse>("GET", "/api/me");
    expect(before.json.user?.xp).toBe(0);

    const start = await c.req<StartSessionResponse>("POST", "/api/sessions", {
      unitId: 1001,
      difficulty: "normal",
    });
    expect(start.status).toBe(200);
    expect(start.json.words.length).toBeGreaterThanOrEqual(10);

    const events = perfectRun(start.json.words);
    // The server compares event time with its wall clock, so wait for a plausible duration.
    const total = events[events.length - 1]?.t ?? 0;
    expect(total).toBeGreaterThan(0);

    // Too early => events longer than wall clock => rejected
    const early = await c.req<{ error: string; reason: string }>(
      "POST",
      `/api/sessions/${start.json.sessionId}/finish`,
      { events },
    );
    expect(early.status).toBe(422);
    expect(early.json.reason).toBe("events-longer-than-session");

    // The rejected session cannot be finished again
    const again = await c.req("POST", `/api/sessions/${start.json.sessionId}/finish`, { events });
    expect(again.status).toBe(409);
  });

  it.skipIf(!up)(
    "accepts a valid round and applies SRS / quests / leaderboard",
    async () => {
      const c = new Client();
      const name = `Pro${Date.now() % 100000}`;
      await c.req("POST", "/api/dev/login", { name });

      const start = await c.req<StartSessionResponse>("POST", "/api/sessions", {
        unitId: 1001,
        difficulty: "easy",
      });
      const words = start.json.words;
      // Compress timing so the log fits in the real elapsed time: ~60ms/key stays under 250 WPM? no:
      // 60ms/key = 1000 keys/min = 200 wpm. Use 70ms (~171 wpm).
      const events: GameEvent[] = [];
      let t = 100;
      for (const w of words) {
        for (let i = 0; i < w.lemma.length; i++) {
          events.push({ t, type: "correct", wordId: w.id });
          t += 70;
        }
        events.push({ t, type: "hit", wordId: w.id });
        t += 10;
      }
      // Let a little real time pass so events fit inside the wall clock window.
      await new Promise((r) => setTimeout(r, Math.min(t, 12000)));
      const fin = await c.req<FinishSessionResponse>(
        "POST",
        `/api/sessions/${start.json.sessionId}/finish`,
        { events },
      );
      if (fin.status !== 200) throw new Error(`finish failed: ${JSON.stringify(fin.json)}`);
      expect(fin.json.result.status).toBe("won");
      expect(fin.json.result.stars).toBe(3);
      expect(fin.json.rewards.newStars).toBe(3);
      expect(fin.json.rewards.coinsGained).toBe(15);
      expect(fin.json.rewards.unlockedUnitId).toBe(1002);
      expect(fin.json.rewards.streakDays).toBe(1);

      // replay is refused
      expect(
        (await c.req("POST", `/api/sessions/${start.json.sessionId}/finish`, { events })).status,
      ).toBe(409);

      // unit 2 is now open, unit 3 still locked
      const units = await c.req<UnitsResponse>("GET", "/api/sets/a1/units");
      expect(units.json.units[0]?.bestStars).toBe(3);
      expect(units.json.units[1]?.state).toBe("open");
      expect(units.json.units[2]?.state).toBe("locked");

      // vocab: all hit cleanly => box 1, not due yet
      const learned = await c.req<VocabResponse>("GET", "/api/vocab?filter=learned");
      expect(learned.json.counts.learned).toBe(words.length);
      expect(learned.json.counts.due).toBe(0);

      // quests progressed
      const quests = await c.req<QuestsResponse>("GET", "/api/quests/today");
      expect(quests.json.quests.find((q) => q.key === "play_3")?.progress).toBe(1);
      expect(quests.json.quests.find((q) => q.key === "accuracy_95")?.progress).toBe(1);
      const claim = await c.req("POST", "/api/quests/accuracy_95/claim");
      expect(claim.status).toBe(200);
      expect((await c.req("POST", "/api/quests/accuracy_95/claim")).status).toBe(409);
      expect((await c.req("POST", "/api/quests/play_3/claim")).status).toBe(409);

      // saving words
      const wid = words[0]?.id;
      expect((await c.req("POST", `/api/vocab/${wid}/save`)).status).toBe(200);
      const saved = await c.req<VocabResponse>("GET", "/api/vocab?filter=saved");
      expect(saved.json.items.map((i) => i.id)).toEqual([wid]);
      expect((await c.req("DELETE", `/api/vocab/${wid}/save`)).status).toBe(200);

      // leaderboard shows the player, unless earlier runs against the same local database already
      // filled the top 20 with scores at least as high (ties are cut arbitrarily)
      const lb = await c.req<LeaderboardResponse>("GET", "/api/leaderboard?period=week");
      const entries = lb.json.entries;
      const listed = entries.some((e) => e.displayName === name);
      const full = entries.length >= 20 && (entries.at(-1)?.score ?? 0) >= fin.json.result.score;
      expect(listed || full).toBe(true);

      // profile reflects XP, coins (15 star coins + 25 quest) and level
      const me = await c.req<MeResponse>("GET", "/api/me");
      expect(me.json.user?.coins).toBe(40);
      expect(me.json.user?.xp).toBe(fin.json.rewards.xp);
    },
    30000,
  );

  it.skipIf(!up)("rejects forged logs", async () => {
    const c = new Client();
    await c.req("POST", "/api/dev/login", { name: `Cheat${Date.now() % 100000}` });
    const start = await c.req<StartSessionResponse>("POST", "/api/sessions", {
      unitId: 1001,
      difficulty: "easy",
    });
    const forged: GameEvent[] = start.json.words.map((w, i) => ({
      t: 100 + i,
      type: "hit" as const,
      wordId: w.id,
    }));
    const res = await c.req<{ reason: string }>(
      "POST",
      `/api/sessions/${start.json.sessionId}/finish`,
      {
        events: forged,
      },
    );
    expect(res.status).toBe(422);
    expect(res.json.reason).toBe("hit-without-typing");

    // someone else's session id is not found
    const other = new Client();
    await other.req("POST", "/api/dev/login", { name: `Other${Date.now() % 100000}` });
    const s2 = await c.req<StartSessionResponse>("POST", "/api/sessions", {
      unitId: 1001,
      difficulty: "easy",
    });
    expect(
      (await other.req("POST", `/api/sessions/${s2.json.sessionId}/finish`, { events: forged }))
        .status,
    ).toBe(404);

    // locked unit
    expect(
      (await c.req("POST", "/api/sessions", { unitId: 1005, difficulty: "easy" })).status,
    ).toBe(403);
  });

  it.skipIf(!up)(
    "ghost race and sentence express save per-game progress and ghosts",
    async () => {
      const c = new Client();
      await c.req("POST", "/api/dev/login", { name: `Multi${Date.now() % 100000}` });

      // Ghost Race: type every word, ~90ms per key
      const race = await c.req<StartSessionResponse>("POST", "/api/sessions", {
        gameId: "ghost-race",
        unitId: 1001,
        difficulty: "easy",
      });
      expect(race.status).toBe(200);
      expect(race.json.gameId).toBe("ghost-race");
      expect(race.json.ghosts.some((g) => g.kind === "best")).toBe(false);
      const raceEvents: RaceEvent[] = [];
      let t = 100;
      for (const w of race.json.words) {
        for (let i = 0; i < w.lemma.length; i++) {
          raceEvents.push({ t, type: "correct", wordId: w.id });
          t += 90;
        }
        raceEvents.push({ t: t - 90, type: "done", wordId: w.id });
      }
      await new Promise((r) => setTimeout(r, Math.min(t, 15000)));
      const raceFin = await c.req<FinishSessionResponse>(
        "POST",
        `/api/sessions/${race.json.sessionId}/finish`,
        { events: raceEvents },
      );
      if (raceFin.status !== 200) throw new Error(`race: ${JSON.stringify(raceFin.json)}`);
      expect(raceFin.json.result.status).toBe("won");
      expect(raceFin.json.rewards.unlockedUnitId).toBe(1002);

      // progress is per game: word blaster still has only the first units open
      const raceUnits = await c.req<UnitsResponse>("GET", "/api/sets/a1/units?game=ghost-race");
      expect(raceUnits.json.units[1]?.state).toBe("open");
      const blasterUnits = await c.req<UnitsResponse>("GET", "/api/sets/a1/units");
      expect(blasterUnits.json.units[1]?.state).toBe("locked");

      // the next race brings your own ghost
      const race2 = await c.req<StartSessionResponse>("POST", "/api/sessions", {
        gameId: "ghost-race",
        unitId: 1001,
        difficulty: "easy",
      });
      const best = race2.json.ghosts.find((g) => g.kind === "best");
      expect(best?.points.at(-1)?.[1]).toBe(1);

      // Sentence Express: a timed run over a whole set
      const train = await c.req<StartSessionResponse>("POST", "/api/sessions", {
        gameId: "sentence-express",
        setSlug: "b1",
      });
      expect(train.status).toBe(200);
      expect(train.json.sentences.length).toBe(80);
      expect(new Set(train.json.sentences.map((s) => s.id)).size).toBe(80);
      const trainEvents: TrainEvent[] = train.json.sentences.map((s, i) => ({
        t: 3000 * (i + 1),
        type: "submit",
        sentenceId: s.id,
        answer: sentenceParts(s.en).words,
      }));
      // a wrong answer with different words is a forgery
      const forged = await c.req<{ reason: string }>(
        "POST",
        `/api/sessions/${train.json.sessionId}/finish`,
        { events: [{ ...trainEvents[0], answer: ["nope"] }] },
      );
      expect(forged.status).toBe(422);
      expect(forged.json.reason).toBe("answer-not-the-sentence");

      const train2 = await c.req<StartSessionResponse>("POST", "/api/sessions", {
        gameId: "sentence-express",
        setSlug: "a1",
      });
      const events2: TrainEvent[] = train2.json.sentences.slice(0, 6).map((s, i) => ({
        t: 1000 * (i + 1),
        type: "submit",
        sentenceId: s.id,
        answer: sentenceParts(s.en).words,
      }));
      await new Promise((r) => setTimeout(r, (events2.at(-1)?.t ?? 0) + 200));
      const trainFin = await c.req<FinishSessionResponse>(
        "POST",
        `/api/sessions/${train2.json.sessionId}/finish`,
        { events: events2 },
      );
      if (trainFin.status !== 200) throw new Error(`train: ${JSON.stringify(trainFin.json)}`);
      expect(trainFin.json.result.status).toBe("won");
      expect(trainFin.json.result.stars).toBe(1);
      expect(trainFin.json.rewards.unlockedUnitId).toBeNull();

      // the set page shows the best run
      const sets = await c.req<TrainSetsResponse>("GET", "/api/train/sets");
      const a1 = sets.json.sets.find((s) => s.slug === "a1");
      expect(a1?.bestScore).toBe(trainFin.json.result.score);
      expect(sets.json.sets.map((s) => s.slug)).toEqual(["a1", "a2", "b1", "b2", "c1", "c2"]);

      // vocab is shared: keywords from both games are in the same notebook
      const learned = await c.req<VocabResponse>("GET", "/api/vocab?filter=learned");
      expect(learned.json.counts.learned).toBeGreaterThanOrEqual(race.json.words.length);

      const lb = await c.req<LeaderboardResponse>(
        "GET",
        "/api/leaderboard?period=week&game=sentence-express",
      );
      expect(lb.status).toBe(200);
    },
    40000,
  );
});
