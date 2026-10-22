import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __wordBlaster?: {
      status: string;
      prompt: { lemma: string } | null;
      typed: string;
    };
    __ghostRace?: { status: string; current?: { lemma: string }; typed: string };
    __sentenceExpress?: {
      status: string;
      departing: boolean;
      buffer: string;
      placed: number[];
      solvedCount: number;
      parts: { words: string[] };
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("lexi.settings.v1", JSON.stringify({ difficulty: "hard", sound: false }));
    // The local worker proxy now and then drops a request, and Vite shows its error overlay over
    // the app; that is a dev-server flake, not something the app can fix, so keep it out of the way.
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent = "vite-error-overlay{display:none!important}";
      document.head.append(style);
    });
  });
});

/** Plays a whole round through the real keyboard path (hidden input + window keydown). */
async function playRound(page: Page) {
  await page.waitForFunction(() => window.__wordBlaster?.status === "playing", null, {
    timeout: 20_000,
  });
  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const g = window.__wordBlaster;
      if (!g) return { status: "gone", word: null };
      // answer the question on screen: the English word for the Vietnamese prompt
      return { status: g.status, word: g.prompt && !g.typed ? g.prompt.lemma : null };
    });
    if (state.status === "won" || state.status === "lost" || state.status === "gone")
      return state.status;
    if (state.word) await page.keyboard.type(state.word, { delay: 75 });
    else await page.waitForTimeout(80);
  }
  throw new Error("round did not finish");
}

test("guest can browse, play unit 1 and sees an unsaved result", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CHỌN TRÒ CHƠI" })).toBeVisible();
  await page
    .getByRole("link", { name: /CHƠI NGAY/i })
    .first()
    .click();
  await expect(page.getByText("BỘ TỪ VỰNG")).toBeVisible();

  // guests only get the first 3 units
  await expect(page.getByRole("button", { name: /Mốc 4:.*đã khoá/ })).toBeVisible();
  await page.getByRole("button", { name: /Mốc 4:/ }).click();
  await expect(page.getByText(/Khách chỉ chơi được 3 mốc đầu/)).toBeVisible();

  await page.getByRole("button", { name: /Mốc 1:/ }).click();
  await page.getByRole("button", { name: /BẮT ĐẦU/i }).click();
  expect(await playRound(page)).toBe("won");

  await expect(page.getByRole("heading", { name: "HOÀN THÀNH!" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/chưa được lưu/)).toBeVisible();
});

test("a Vietnamese IME key pauses the game with instructions", async ({ page }) => {
  await page.goto("/games/word-blaster/play/1001?set=a1");
  await page.waitForFunction(() => window.__wordBlaster?.status === "playing", null, {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Process", keyCode: 229, bubbles: true }),
    );
  });
  await expect(page.getByRole("dialog", { name: /bộ gõ tiếng Việt/i })).toBeVisible();
  expect(await page.evaluate(() => window.__wordBlaster?.status)).toBe("paused");
  await page.getByRole("button", { name: /TIẾP TỤC/i }).click();
  expect(await page.evaluate(() => window.__wordBlaster?.status)).toBe("playing");
});

test("logged-in player saves progress and unlocks the next unit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /ĐĂNG NHẬP THỬ/i }).click();
  await expect(page.getByRole("link", { name: "Hồ sơ người chơi" })).toBeVisible();

  await page.goto("/games/word-blaster/play/1001?set=a1");
  expect(await playRound(page)).toBe("won");
  await expect(page.getByRole("heading", { name: "HOÀN THÀNH!" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();

  await page.getByRole("button", { name: /BẢN ĐỒ/i }).click();
  await expect(page.getByRole("button", { name: /Mốc 2:/ })).not.toContainText("đã khoá");

  await page.goto("/vocab");
  await expect(page.getByRole("tab", { name: /Đã học \d+/ })).toBeVisible();
  await expect(page.getByText("boy", { exact: true })).toBeVisible();
});

test("small screens get the desktop-only screen", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "HÃY MỞ TRÊN MÁY TÍNH" })).toBeVisible();
});

test("guest races Ghost Race unit 1 to the finish", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /GHOST RACE/ }).click();
  await expect(page.getByText("GHOST RACE").first()).toBeVisible();
  await page.getByRole("button", { name: /Mốc 1:/ }).click();
  await page.getByRole("button", { name: /XUẤT PHÁT/i }).click();
  await page.waitForFunction(() => window.__ghostRace?.status === "playing", null, {
    timeout: 20_000,
  });
  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const g = window.__ghostRace;
      return { status: g?.status, rest: g?.current?.lemma.slice(g.typed.length) ?? "" };
    });
    if (s.status === "over") break;
    if (s.rest) await page.keyboard.type(s.rest, { delay: 70 });
    else await page.waitForTimeout(80);
  }
  await expect(page.getByRole("heading", { name: "HOÀN THÀNH!" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Thời gian")).toBeVisible();
});

test("guest picks a set in Sentence Express and plays until the coal runs out", async ({
  page,
}) => {
  await page.goto("/games/sentence-express");
  await page.getByRole("button", { name: /Bộ B1/ }).click();
  await page.getByRole("button", { name: /LÊN TÀU · B1/i }).click();
  await expect(page).toHaveURL(/\/games\/sentence-express\/play\/b1$/);
  await page.waitForFunction(() => window.__sentenceExpress?.status === "playing", null, {
    timeout: 20_000,
  });
  const state = () =>
    page.evaluate(() => {
      const g = window.__sentenceExpress;
      return {
        status: g?.status,
        ready: !!g && !g.departing && g.placed.length === 0,
        words: g?.parts.words ?? [],
        solved: g?.solvedCount ?? 0,
      };
    });
  // three right trains, typed on the keyboard
  for (let n = 0; n < 3; n++) {
    await page.waitForFunction(() => {
      const g = window.__sentenceExpress;
      return !!g && !g.departing && g.placed.length === 0;
    });
    for (const w of (await state()).words) {
      await page.keyboard.type(w.toLowerCase().replace(/[^a-z'-]/g, ""), { delay: 30 });
      if (await page.evaluate(() => !!window.__sentenceExpress?.buffer))
        await page.keyboard.press("Space");
    }
    await page.keyboard.press("Enter");
    await page.waitForFunction((k) => (window.__sentenceExpress?.solvedCount ?? 0) > k, n);
  }
  await expect(page.getByRole("timer")).toBeVisible();
  // then three wrong ones: crates clicked in yard order, which is never the sentence's order
  await page.waitForFunction(() => {
    const g = window.__sentenceExpress;
    return !!g && !g.departing && g.placed.length === 0;
  });
  for (let n = 0; n < 3; n++) {
    await page.evaluate(() => {
      const g = window.__sentenceExpress as unknown as {
        placed: number[];
        crates: { id: number }[];
        place: (id: number) => void;
        unplace: (slot: number) => void;
      };
      while (g.placed.length) g.unplace(0);
      for (const c of g.crates) g.place(c.id);
    });
    await page.keyboard.press("Enter");
  }
  await expect(page.getByRole("heading", { name: "HẾT THAN!" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Câu đúng")).toBeVisible();
});
