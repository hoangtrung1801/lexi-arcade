import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __wordBlaster?: {
      status: string;
      prompt: { lemma: string } | null;
      typed: string;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("lexi.settings.v1", JSON.stringify({ difficulty: "hard", sound: false })),
  );
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
  await page.getByRole("link", { name: /CHƠI NGAY/i }).click();
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
