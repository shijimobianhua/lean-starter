import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import jsQR from "jsqr";
const require = createRequire(import.meta.url),
  { PNG } = require("pngjs");
async function nav(p: any, name: string) {
  await p
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test("个人源码可独立运行、记录、备份、切主题并分享回本站", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page).toHaveTitle("薄肌 LEAN · 个人版");
  await page.getByRole("button", { name: /开始薄肌之旅/ }).click();
  await page.getByRole("button", { name: "男 薄肌", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  await page.getByLabel("体重（kg）", { exact: true }).fill("72.3");
  await page.getByRole("button", { name: "保存体重", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toContainText("72.3");
  await expect(page.locator(".app-toast")).toHaveCount(0);
  await fs.mkdir("artifacts/starter", { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/starter/home.png",
    fullPage: false,
    animations: "disabled",
  });
  await nav(page, "趋势");
  await expect(page.locator(".trend-swipe")).toBeVisible();
  await nav(page, "我的");
  await expect(page.locator(".starter-attribution")).toContainText("非官方");
  await page.getByRole("button", { name: "深色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await nav(page, "趋势");
  await expect(page.locator(".trend-swipe")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/starter/trends.png",
    fullPage: false,
    animations: "disabled",
  });
  await nav(page, "我的");
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "artifacts/starter/profile.png",
    fullPage: false,
    animations: "disabled",
  });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份", exact: true }).click();
  const backup = await download;
  await backup.saveAs("artifacts/starter/synthetic-backup.json");
  const raw = JSON.parse(
    await fs.readFile("artifacts/starter/synthetic-backup.json", "utf8"),
  );
  expect(raw.weights.some((r: any) => r.weightKg === 72.3)).toBe(true);
  await page.getByRole("button", { name: /薄肌学士学位考核/ }).click();
  await page.getByRole("button", { name: "制作分享卡", exact: true }).click();
  await page.getByRole("button", { name: "自己写一句", exact: true }).click();
  await page.getByLabel("自定义短句").fill("记录今天，按自己的节奏继续。");
  await page.getByRole("button", { name: "预览卡片", exact: true }).click();
  await expect(page.locator(".share-preview img")).toBeVisible();
  const pixels = await page
    .locator(".share-preview img")
    .evaluate(async (img: HTMLImageElement) =>
      Array.from(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),
    );
  const save = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存图片", exact: true }).click();
  await (await save).saveAs("artifacts/starter/share.png");
  const bytes = await fs.readFile("artifacts/starter/share.png");
  expect(bytes.equals(Buffer.from(pixels))).toBe(true);
  const png = PNG.sync.read(bytes);
  expect([png.width, png.height]).toEqual([1080, 1440]);
  expect(
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
  ).toBe("http://127.0.0.1:4165/");
  const manifest = await page.evaluate(
    async () => await (await fetch("/manifest.webmanifest")).json(),
  );
  expect(manifest.name).toBe("薄肌 LEAN · 个人版");
});
test("第二个独立浏览器没有前一个人的本机记录", async ({ browser }) => {
  const c = await browser.newContext();
  const p = await c.newPage();
  await p.goto("/");
  await expect(p.getByRole("heading", { name: /是否开始/ })).toBeVisible();
  await c.close();
});
