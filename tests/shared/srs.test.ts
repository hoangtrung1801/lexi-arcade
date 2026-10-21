import { levelFromXp, nextStreak, srsUpdate, vnDate, vnWeek } from "@shared/index";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const DAY = 86400000;

describe("srs", () => {
  it("promotes on clean hit and schedules by interval", () => {
    const u = srsUpdate(1, "clean", NOW);
    expect(u.box).toBe(2);
    expect(u.dueAt).toBe(NOW + 3 * DAY);
  });
  it("caps at box 5 (30 days)", () => {
    const u = srsUpdate(5, "clean", NOW);
    expect(u.box).toBe(5);
    expect(u.dueAt).toBe(NOW + 30 * DAY);
  });
  it("drops to box 0 when missed, due now", () => {
    const u = srsUpdate(4, "missed", NOW);
    expect(u.box).toBe(0);
    expect(u.dueAt).toBe(NOW);
  });
  it("keeps the box when sloppy", () => {
    expect(srsUpdate(3, "sloppy", NOW).box).toBe(3);
  });
});

describe("progress helpers", () => {
  it("uses Vietnam time for dates", () => {
    expect(vnDate(Date.UTC(2026, 9, 20, 17, 30))).toBe("2026-10-21");
    expect(vnDate(Date.UTC(2026, 9, 20, 16, 59))).toBe("2026-10-20");
  });
  it("week starts on Monday", () => {
    expect(vnWeek(Date.UTC(2026, 9, 20, 5))).toBe("2026-10-19");
    expect(vnWeek(Date.UTC(2026, 9, 18, 5))).toBe("2026-10-12");
  });
  it("streak continues, holds, or resets", () => {
    expect(nextStreak(0, null, "2026-10-20")).toBe(1);
    expect(nextStreak(4, "2026-10-19", "2026-10-20")).toBe(5);
    expect(nextStreak(4, "2026-10-20", "2026-10-20")).toBe(4);
    expect(nextStreak(4, "2026-10-10", "2026-10-20")).toBe(1);
  });
  it("level curve", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(400)).toBe(3);
  });
});
