import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-specific";
async function start(p: Page) {
  await p.goto("/");
  await p.getByRole("button", {name:/普通使用版/}).click();
  await p.getByRole("button", { name: "男 薄肌", exact: true }).click();
  for (let i = 0; i < 2; i++)
    await p.getByRole("button", { name: "继续", exact: true }).click();
  await p.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function nav(p: Page, name: string) {
  await p
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
for (const platform of ["ios", "android"]) {
  test(
    platform + " 功能微彩白卡、暖灰暗卡和版本一致；首页卡片返回记忆且刷新重置",
    async ({ page }) => {
      await fs.mkdir(out, { recursive: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await start(page);
      await page.evaluate(
        (p) => (document.documentElement.dataset.platform = p),
        platform,
      );
      await nav(page, "我的");
      await expect(page.getByTestId("app-version")).toHaveText(
        "薄肌 LEAN · v1.6.6",
      );
      await page.getByRole("button", { name: "浅色", exact: true }).click();
      await page
        .getByRole("button", { name: "体重管理方案", exact: false })
        .click();
      let d = page.getByRole("dialog");
      await d.getByLabel("初始体重（kg）").fill("75");
      await d.getByLabel("目标体重（kg）").fill("65");
      await d.getByRole("button", { name: "保存方案" }).click();
      await expect(d).toHaveCount(0);
      await nav(page, "今天");
      await page.getByRole("button", { name: "显示体重进度" }).click();
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(650);
        await expect(
          page.getByRole("heading", {
            name: "五倍做多自己的身体",
            exact: true,
          }),
        ).toBeVisible();
        const surfaces = await page
          .locator(".metric,.weight-progress")
          .evaluateAll((es) =>
            es.map((e) => getComputedStyle(e).backgroundColor),
          );
        expect(surfaces.every((c) => c === "rgb(255, 255, 255)")).toBe(true);
        const colours = await page
          .locator(
            ".metric.blue .metric-label>svg,.metric.lavender .metric-label>svg,.metric.peach .metric-label>svg",
          )
          .evaluateAll((es) =>
            es.map((e) => getComputedStyle(e).backgroundColor),
          );
        expect(new Set(colours).size).toBe(3);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `${out}/${platform}-${width}-light.png`,
          animations: "disabled",
        });
      }
      for (const name of ["我的", "日历", "趋势", "今天"]) {
        await nav(page, name);
      }
      await expect(
        page.getByRole("button", { name: "显示体重进度" }),
      ).toHaveAttribute("aria-pressed", "true");
      await nav(page, "我的");
      await page.getByRole("button", { name: "深色", exact: true }).click();
      await nav(page, "今天");
      await expect(page.locator(".weight-progress")).toHaveCSS(
        "background-color",
        "rgb(41, 39, 36)",
      );
      await expect(
        page.getByRole("heading", { name: "五倍做多自己的身体", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${out}/${platform}-dark.png`,
        animations: "disabled",
      });
      await page.reload();
      await expect(
        page.getByRole("button", { name: "显示每日一句" }),
      ).toHaveAttribute("aria-pressed", "true");
      await nav(page, "我的");
      await expect(page.getByTestId("app-version")).toContainText("1.6.6");
    },
  );
}
test("趋势范围与BMI、照片月份与排序定位、日历日期和周期跨页恢复，弹窗不自动打开", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("form-daily");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction(["profile", "photos"], "readwrite");
    tx.objectStore("profile").put({
      id: "local",
      heightCm: 175,
      gender: "male",
      onboardingDone: true,
    });
    const b = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=",
      ),
      (c) => c.charCodeAt(0),
    );
    for (const date of ["2026-09-12", "2026-10-11"])
      tx.objectStore("photos").put({
        id: "memory-" + date,
        date,
        createdAt: date + "T08:00:00Z",
        image: new Blob([b], { type: "image/png" }),
      });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await nav(page, "趋势");
  const tabs = page.getByLabel("趋势分类");
  await tabs.getByRole("button", { name: "大水", exact: true }).click();
  await page.getByLabel("趋势日期范围").selectOption("90");
  await nav(page, "日历");
  await page.getByRole("button", { name: "选择年月日", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.locator('input[type="date"]').fill("2026-08-15");
  await d.getByRole("button", { name: "确认日期" }).click();
  await expect(d).toHaveCount(0);
  await page.getByRole("button", { name: "周", exact: true }).click();
  await nav(page, "趋势");
  await expect(
    tabs.getByRole("button", { name: "大水", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("趋势日期范围")).toHaveValue("90");
  await tabs.getByRole("button", { name: "体重", exact: true }).click();
  await page.getByLabel("显示 BMI", { exact: true }).check();
  await nav(page, "我的");
  await nav(page, "趋势");
  await expect(page.getByLabel("显示 BMI", { exact: true })).toBeChecked();
  await tabs.getByRole("button", { name: "薄肌", exact: true }).click();
  await page.getByLabel("照片排序").selectOption("asc");
  await page.getByLabel("定位照片日期").fill("2026-09-12");
  await page.getByRole("button", { name: "定位日期", exact: true }).click();
  const sep = page.getByRole("button", { name: /2026年9月/ });
  await sep.click();
  await expect(sep).toHaveAttribute("aria-expanded", "false");
  await nav(page, "日历");
  await expect(
    page.getByRole("button", { name: "选择年月日", exact: true }),
  ).toContainText("2026年 8月");
  await expect(
    page.getByRole("button", { name: /2026-08-15/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "周", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav(page, "趋势");
  await expect(
    tabs.getByRole("button", { name: "薄肌", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("照片排序")).toHaveValue("asc");
  await expect(page.getByLabel("定位照片日期")).toHaveValue("2026-09-12");
  await expect(sep).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "今天");
  await page.getByRole("button", { name: /把变化/ }).click();
  await expect(page.getByLabel("照片排序")).toHaveValue("asc");
  await nav(page, "我的");
  await nav(page, "今天");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
