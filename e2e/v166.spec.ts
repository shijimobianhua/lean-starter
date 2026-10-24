import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-design";
async function nav(p: Page, name: string) {
  await p
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function start(p: Page, lean = true) {
  await p.goto("/");
  await p
    .getByRole("button", { name: lean ? /开始薄肌之旅/ : /普通使用版/ })
    .click();
  await p.getByRole("button", { name: "男 薄肌", exact: true }).click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await p.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function shot(p: Page, name: string) {
  await fs.mkdir(out, { recursive: true });
  await p.waitForTimeout(700);
  await p.screenshot({
    path: `${out}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
async function seed(p: Page) {
  await p.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("form-daily");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["profile", "weights", "training", "water", "sleep"],
        "readwrite",
      );
      tx.objectStore("profile").put({
        id: "local",
        gender: "male",
        onboardingDone: true,
        style: "lean",
        heightCm: 178,
        waistCm: 78,
        weightPlan: {
          id: "demo",
          startDate: "2026-10-01",
          targetDate: "2027-01-21",
          startKg: 75,
          targetKg: 65,
        },
      });
      for (let i = 0; i < 7; i++) {
        const date = `2026-10-${17 + i}`;
        tx.objectStore("weights").put({
          date,
          weightKg: 75 - i * 0.5,
          updatedAt: "2026-10-23T00:00:00Z",
        });
        tx.objectStore("training").put({
          date,
          status: "trained",
          aerobic: "慢跑",
          anaerobic: "",
          items: [
            { exerciseId: "walk", name: "步行", kind: "aerobic", minutes: 30 },
          ],
          updatedAt: "2026-10-23T00:00:00Z",
        });
      }
      tx.objectStore("water").put({
        date: "2026-10-23",
        morningMl: 600,
        noonMl: 600,
        eveningMl: 600,
      });
      tx.objectStore("sleep").put({
        wakeDate: "2026-10-23",
        startAt: "2026-10-22T15:00:00Z",
        endAt: "2026-10-22T22:30:00Z",
        timeZone: "Asia/Shanghai",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await p.reload();
  await expect(p.locator(".lean-home")).toBeVisible();
}
async function switchStyle(p: Page, lean: boolean) {
  await nav(p, "我的");
  await p.getByRole("button", { name: /风格选择.*[›]/ }).click();
  await p
    .getByRole("button", {
      name: lean ? /薄肌风格.*身体线条/ : /默认风格.*清晰/,
    })
    .click();
  await p.getByRole("button", { name: "使用此风格", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function noOverflow(p: Page) {
  await expect
    .poll(() =>
      p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
}

test("旅程选择先于性别，返回与刷新保留草稿且未提前完成", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /是否开始/ })).toBeVisible();
  await shot(page, "welcome-choice");
  await page.getByRole("button", { name: /开始薄肌之旅/ }).click();
  await expect(page.getByRole("heading", { name: "从你开始" })).toBeVisible();
  await page.getByRole("button", { name: "女 马甲线", exact: true }).click();
  await page.getByRole("button", { name: "返回选择使用方式" }).click();
  await expect(page.getByRole("heading", { name: /是否开始/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /是否开始/ })).toBeVisible();
  await page.getByRole("button", { name: /开始薄肌之旅/ }).click();
  await expect(
    page.getByRole("button", { name: "女 马甲线", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "让日常，随身" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.locator(".lean-home")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("普通版保持默认、切换预览取消和确认持久化且数据不变", async ({ page }) => {
  await start(page, false);
  await expect(page.locator(".lean-home")).toHaveCount(0);
  await nav(page, "我的");
  await expect(page.getByRole("button", { name: /更新日志/ })).toHaveCount(0);
  await expect(page.getByTestId("app-version")).toHaveText(
    "薄肌 LEAN · v1.6.6",
  );
  await page.getByRole("button", { name: /风格选择/ }).click();
  await page.getByRole("button", { name: /薄肌风格.*身体线条/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "lean");
  await shot(page, "style-picker");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-style", "default");
  await switchStyle(page, true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-style", "lean");
  await seed(page);
  await switchStyle(page, false);
  await switchStyle(page, true);
  await nav(page, "今天");
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toContainText("72");
});
for (const theme of ["浅色", "深色"])
  test(`双风格${theme}四页面、表单、窄屏均完整`, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-23T04:00:00Z"));
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await seed(page);
    for (const lean of [true, false]) {
      await switchStyle(page, lean);
      await nav(page, "我的");
      await page.getByRole("button", { name: theme, exact: true }).click();
      for (const name of ["今天", "趋势", "日历", "我的"]) {
        await nav(page, name);
        if (name === "趋势")
          await expect(page.locator(".trend-swipe")).toBeVisible();
        await noOverflow(page);
        await shot(page, `${lean ? "lean" : "default"}-${theme}-${name}`);
      }
      await page.getByRole("button", { name: /身体资料/ }).click();
      await expect(page.getByLabel("腰围（cm）")).toHaveValue("78");
      await shot(page, `${lean ? "lean" : "default"}-${theme}-body`);
      await page.getByRole("button", { name: "关闭浮窗", exact: true }).click();
      await page.setViewportSize({ width: 320, height: 740 });
      await nav(page, "今天");
      await noOverflow(page);
      await shot(page, `${lean ? "lean" : "default"}-${theme}-320`);
      await page.setViewportSize({ width: 390, height: 844 });
    }
  });
test("薄肌空记录无假数字，保存后出现且三围不暴露", async ({ page }) => {
  await start(page);
  await expect(page.locator(".lean-life>strong")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "记录薄肌" }),
  ).not.toContainText("30");
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  await page.getByLabel("体重（kg）", { exact: true }).fill("72.3");
  await page.getByRole("button", { name: "保存体重", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toContainText("72.3");
  await seed(page);
  await nav(page, "我的");
  await expect(page.locator(".lean-body-profile")).not.toContainText("78");
  await expect(page.locator(".lean-body-profile")).toContainText("私密查看");
});
test("薄肌分享默认线条模板、30字、真实导出预览、返回保留", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-23T04:00:00Z"));
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button", { name: /薄肌学士学位考核/ }).click();
  await page.getByRole("button", { name: "制作分享卡", exact: true }).click();
  await expect(page.getByRole("button", { name: /薄肌线条/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await shot(page, "lean-share-editor");
  await page.getByRole("button", { name: "预览卡片", exact: true }).click();
  await expect(page.locator(".share-preview img")).toBeVisible();
  await shot(page, "lean-share-preview");
  await page.getByRole("button", { name: /返回编辑/ }).click();
  await expect(page.getByRole("button", { name: /薄肌线条/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("跟随系统、减少动态、离线重开保持风格", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button", { name: "跟随系统", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-style", "lean");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-style", "lean");
  await nav(page, "今天");
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
