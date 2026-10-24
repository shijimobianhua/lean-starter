import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import jsQR from "jsqr";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const out = "artifacts/v166-sharing";
const url = "http://127.0.0.1:4165/";
async function start(p: Page) {
  await p.clock.setFixedTime(new Date("2026-10-20T04:00:00Z"));
  await p.goto("/");
  await p.getByRole("button", { name: /普通使用版/ }).click();
  await p.getByRole("button", { name: "男 薄肌", exact: true }).click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await p.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function seed(p: Page, count = 100) {
  await p.evaluate(async (count) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("form-daily");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["training", "water", "sleep", "weights"],
        "readwrite",
      );
      for (let i = 0; i < count; i++) {
        const d = new Date("2026-10-20T12:00:00");
        d.setDate(d.getDate() - i);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        tx.objectStore("training").put({
          date: day,
          status: "trained",
          aerobic: "散步",
          anaerobic: "",
          updatedAt: "",
        });
      }
      tx.objectStore("water").put({
        date: "2026-10-20",
        morningMl: 0,
        noonMl: 500,
        eveningMl: 300,
      });
      tx.objectStore("sleep").put({
        wakeDate: "2026-10-20",
        startAt: "2026-10-19T23:00:00+08:00",
        endAt: "2026-10-20T07:00:00+08:00",
        timeZone: "Asia/Shanghai",
      });
      tx.objectStore("weights").put({
        date: "2026-10-20",
        weightKg: 72.3,
        updatedAt: "",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, count);
  await p.reload();
}
async function studio(p: Page) {
  await p
    .getByRole("navigation")
    .getByRole("button", { name: "我的", exact: true })
    .click();
  await p.getByRole("button", { name: /薄肌学士学位考核/ }).click();
  await p.getByRole("button", { name: "制作分享卡", exact: true }).click();
  await expect(p.getByRole("button", { name: /预览卡片/ })).toBeVisible();
}
async function waitNew(p: Page, action: () => Promise<unknown>) {
  await action();
}
async function preview(p: Page) {
  await p.getByRole("button", { name: /预览卡片/ }).click();
  await expect(p.locator(".share-preview img")).toBeVisible();
}
test("空态锁定、原生返回与编辑选择保留，不写入健康记录", async ({ page }) => {
  await start(page);
  await studio(page);
  await expect(
    page.getByRole("button", { name: /今日记录.*今天暂无记录/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /毕业纪念.*历史最长需满100天/ }),
  ).toBeDisabled();
  await waitNew(page, () => page.getByLabel("显示昵称（可选）").check());
  await waitNew(page, () => page.getByLabel("分享昵称").fill("👨‍👩‍👧‍👦".repeat(13)));
  await expect(page.getByLabel("分享昵称")).toHaveValue("👨‍👩‍👧‍👦".repeat(12));
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "我的薄肌学位", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "制作分享卡", exact: true }).click();
  await expect(page.getByLabel("分享昵称")).toHaveValue("👨‍👩‍👧‍👦".repeat(12));
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const n = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("form-daily");
      q.onsuccess = () => r(q.result);
    });
    const n = await Promise.all(
      ["training", "water", "sleep", "weights", "photos"].map(
        (name) =>
          new Promise<number>((r) => {
            const q = db.transaction(name).objectStore(name).count();
            q.onsuccess = () => r(q.result);
          }),
      ),
    );
    db.close();
    return n;
  });
  expect(n).toEqual([0, 0, 0, 0, 0]);
  await page.reload();
  await studio(page);
  await expect(page.getByLabel("显示昵称（可选）")).not.toBeChecked();
});
test("十六种组合均导出真实PNG，预览与下载逐字节一致、二维码可解码", async ({
  page,
}) => {
  await fs.mkdir(out, { recursive: true });
  await start(page);
  await seed(page);
  await studio(page);
  for (const [ki, kind] of [
    "入学卡",
    "今日记录",
    "学位进度",
    "毕业纪念",
  ].entries()) {
    const kindButton = page
      .locator(".share-choice-grid")
      .getByRole("button", { name: new RegExp(kind) });
    if ((await kindButton.getAttribute("aria-pressed")) !== "true")
      await waitNew(page, () => kindButton.click());
    for (const [ti, name] of [
      "极简学位",
      "抽象自嘲",
      "暖灰档案",
      "薄肌线条",
    ].entries()) {
      const b = page.getByRole("button", { name: new RegExp(name) });
      if ((await b.getAttribute("aria-pressed")) !== "true")
        await waitNew(page, () => b.click());
      await preview(page);
      const pixels = await page
        .locator(".share-preview img")
        .evaluate(async (img: HTMLImageElement) =>
          Array.from(
            new Uint8Array(await (await fetch(img.src)).arrayBuffer()),
          ),
        );
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "保存图片", exact: true }).click();
      const download = await downloadPromise;
      const file = `${out}/card-${ki}-${ti}.png`;
      await download.saveAs(file);
      const bytes = await fs.readFile(file);
      expect(bytes.equals(Buffer.from(pixels))).toBe(true);
      const png = PNG.sync.read(bytes);
      expect([png.width, png.height]).toEqual([1080, 1440]);
      const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      expect(qr?.data).toBe(url);
      await page.getByRole("button", { name: /返回编辑/ }).click();
      await expect(page.locator(".share-studio")).toBeVisible();
    }
  }
});
test("320和390窄屏、深浅色、最长昵称不会水平溢出", async ({ page }) => {
  await fs.mkdir(out, { recursive: true });
  await start(page);
  await seed(page, 12);
  await studio(page);
  await page.getByLabel("显示昵称（可选）").check();
  await page.getByLabel("分享昵称").fill("薄肌学位修读中的小张同学");
  for (const width of [320, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      await expect(page.locator(".share-studio")).toBeVisible();
      expect(
        await page
          .getByRole("dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: `${out}/editor-${width}-${theme}.png` });
    }
});
test("断网重开后仍能切换模板、生成图片", async ({ page, context }) => {
  await start(page);
  await seed(page, 12);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await studio(page);
  await waitNew(page, () =>
    page.getByRole("button", { name: /暖灰档案/ }).click(),
  );
  await preview(page);
  await expect(
    page.getByRole("button", { name: "保存图片", exact: true }),
  ).toBeEnabled();
});
test("图片分享取消不报故障，失败可保存，复制失败有可选链接", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    });
  });
  await start(page);
  await studio(page);
  await preview(page);
  await page.getByRole("button", { name: "系统分享图片", exact: true }).click();
  await expect(page.getByText("系统分享未完成", { exact: false })).toHaveCount(
    0,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async () => {
        throw new Error("failure");
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "系统分享图片", exact: true }).click();
  await expect(
    page.getByText("系统分享未完成", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "复制产品链接" }).click();
  await expect(page.getByText("复制不可用", { exact: false })).toBeVisible();
  await expect(page.getByLabel("产品入口 · 不包含个人结果")).toHaveValue(url);
});
test("导出故障保留输入可重试；未达标状态不被模板改变", async ({ page }) => {
  await start(page);
  await seed(page, 99);
  await studio(page);
  await page.evaluate(() => {
    (window as any).originalBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null);
    };
  });
  await page.getByRole("button", { name: /暖灰档案/ }).click();
  await page.getByRole("button", { name: /预览卡片/ }).click();
  await expect(page.getByRole("alert")).toContainText("图片生成失败");
  await expect(
    page.getByRole("button", { name: "保存图片", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = (window as any).originalBlob;
  });
  await page.getByRole("button", { name: "重试生成图片" }).click();
  await expect(page.locator(".share-preview img")).toBeVisible();
  await page.getByRole("button", { name: /返回编辑/ }).click();
  await expect(
    page.getByRole("button", { name: /毕业纪念.*历史最长需满100天/ }),
  ).toBeDisabled();
});
