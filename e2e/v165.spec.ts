import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import jsQR from "jsqr";
const require = createRequire(import.meta.url),
  { PNG } = require("pngjs");
const out = "artifacts/v166-design";
async function start(p: Page) {
  await p.clock.setFixedTime(new Date("2026-10-20T05:00:00Z"));
  await p.goto("/");
  await p.getByRole("button", {name:/普通使用版/}).click();
  await p.getByRole("button", { name: "男 薄肌", exact: true }).click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
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
async function studio(p: Page) {
  await nav(p, "我的");
  await p.getByRole("button", { name: /薄肌学士学位考核/ }).click();
  await p.getByRole("button", { name: "制作分享卡", exact: true }).click();
}
async function shot(p: Page, name: string) {
  await fs.mkdir(out, { recursive: true });
  await p.screenshot({ path: `${out}/${name}.png`, animations: "disabled" });
}
async function noOverlap(p: Page) {
  expect(
    await p
      .getByRole("dialog")
      .evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
  ).toBe(true);
  expect(
    await p
      .locator(".modal-content")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
}

test("品牌、首页空态、我的顺序与全局无描边在两种主题一致", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await expect(page).toHaveTitle("薄肌 LEAN · 个人版");
  await expect(page.locator(".release-channel,.degree-entry")).toHaveCount(0);
  await expect(page.locator(".metrics .metric-value")).toHaveCount(0);
  for (const theme of ["浅色", "深色"]) {
    await nav(page, "我的");
    await page.getByRole("button", { name: theme, exact: true }).click();
    await expect(page.getByTestId("app-version")).toHaveText(
      "薄肌 LEAN · v1.6.6",
    );
    const labels = await page.locator(".settings-page").innerText();
    expect(labels).not.toContain("更新日志");
    expect(labels.indexOf("安装与下载")).toBeLessThan(
      labels.indexOf("做空回调"),
    );
    const values = await page
      .locator(
        ".settings-page .panel,.settings-page .theme-options button,.bottom-nav",
      )
      .evaluateAll((es) =>
        es.map((e) => {
          const s = getComputedStyle(e);
          return [s.borderTopWidth, s.boxShadow];
        }),
      );
    expect(values.every((v) => v[0] === "0px")).toBe(true);
    await shot(page, `mine-${theme}`);
    await nav(page, "今天");
    await shot(page, `home-${theme}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.name).toBe("薄肌 LEAN · 个人版");
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});
test("身体资料弹窗可保存、清空、备份和保护未保存输入", async ({ page }) => {
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button", { name: /身体资料/ }).click();
  const d = page.getByRole("dialog", { name: "身体资料", exact: true });
  for (const [name, value] of [
    ["身高", "173.5"],
    ["胸围", "93.2"],
    ["腰围", "78.4"],
    ["臀围", "96.1"],
  ])
    await d.getByLabel(`${name}（cm）`).fill(value);
  await shot(page, "body-profile");
  await d.getByRole("button", { name: "保存身体资料" }).click();
  await expect(d).toHaveCount(0);
  await page.reload();
  await nav(page, "我的");
  await page.getByRole("button", { name: /身体资料/ }).click();
  await expect(d.getByLabel("胸围（cm）")).toHaveValue("93.2");
  await d.getByLabel("腰围（cm）").fill("");
  await d.getByRole("button", { name: "保存身体资料" }).click();
  await expect(d).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份", exact: true }).click();
  const download = await downloadPromise;
  await fs.mkdir(out, { recursive: true });
  const file = `${out}/body-backup.json`;
  await download.saveAs(file);
  const value = JSON.parse(await fs.readFile(file, "utf8"));
  expect(value.profile).toMatchObject({
    heightCm: 173.5,
    chestCm: 93.2,
    waistCm: null,
    hipCm: 96.1,
  });
  expect(value.version).toBe(4);
  await page.getByRole("button", { name: /身体资料/ }).click();
  await d.getByLabel("臀围（cm）").fill("111");
  await d.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(
    page.getByRole("dialog").getByText("身体资料尚未保存，确定放弃修改？"),
  ).toBeVisible();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(d).toHaveCount(0);
  await page.getByRole("button", { name: /身体资料/ }).click();
  await expect(d.getByLabel("臀围（cm）")).toHaveValue("96.1");
});
test("编辑独立预览、30字输入、三模板实际输出和返回保留", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await studio(page);
  await expect(page.locator(".share-preview img")).toHaveCount(0);
  await page.getByRole("button", { name: "自己写一句" }).click();
  const custom = "今天认真记录自己的点滴变化身体慢慢变好生活也会慢慢变得更好呀";
  await page.getByLabel("自定义短句").fill(custom);
  await expect(page.getByLabel("自定义短句")).toHaveValue(
    Array.from(custom).slice(0, 30).join(""),
  );
  await expect(page.locator(".phrase-counter")).toHaveText("30/30");
  const afterGrid = await page.locator(".share-choice-grid").boundingBox(),
    record = await page
      .getByRole("button", { name: /先记录今天/ })
      .boundingBox();
  expect(record!.y).toBeGreaterThanOrEqual(
    afterGrid!.y + afterGrid!.height + 8,
  );
  await noOverlap(page);
  await shot(page, "share-editor");
  for (const [i, name] of ["极简学位", "抽象自嘲", "暖灰档案"].entries()) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    expect(
      await page
        .getByRole("button", { name: new RegExp(name) })
        .evaluate((e) => getComputedStyle(e).outlineStyle),
    ).toBe("none");
    await page.getByRole("button", { name: /预览卡片/ }).click();
    await expect(page.locator(".share-preview img")).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存图片", exact: true }).click();
    const download = await downloadPromise;
    const file = `${out}/custom-30-${i}.png`;
    await download.saveAs(file);
    const png = PNG.sync.read(await fs.readFile(file));
    expect([png.width, png.height]).toEqual([1080, 1440]);
    expect(
      jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
    ).toBe("http://127.0.0.1:4165/");
    await shot(page, `share-preview-${i}`);
    await page.goBack();
    await expect(page.getByLabel("自定义短句")).toHaveValue(
      Array.from(custom).slice(0, 30).join(""),
    );
  }
});
test("中文合成输入与Emoji字数、日期变化后预览失效", async ({ page }) => {
  await start(page);
  await studio(page);
  await page.getByRole("button", { name: "自己写一句" }).click();
  const input = page.getByLabel("自定义短句");
  await input.dispatchEvent("compositionstart");
  await input.fill("学".repeat(31));
  await expect(input).toHaveValue("学".repeat(31));
  await input.dispatchEvent("compositionend");
  await expect(input).toHaveValue("学".repeat(30));
  await input.fill("👨‍👩‍👧‍👦".repeat(31));
  await expect(input).toHaveValue("👨‍👩‍👧‍👦".repeat(30));
  await page.getByRole("button", { name: /预览卡片/ }).click();
  await expect(page.locator(".share-preview img")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-10-21T05:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText("记录已变化");
  await expect(
    page.getByRole("button", { name: "保存图片", exact: true }),
  ).toBeDisabled();
});
test("学位展开图标、长弹窗滚动区域和键盘窄屏不裁切", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button", { name: /薄肌学士学位考核/ }).click();
  const rules = page.getByRole("button", { name: /查看规则/ });
  await rules.click();
  await expect(rules).toHaveAttribute("aria-expanded", "true");
  const arrow = await page
    .locator(".degree-rules .disclosure-arrow")
    .boundingBox();
  expect(arrow!.width).toBeGreaterThanOrEqual(16);
  expect(arrow!.height).toBeGreaterThanOrEqual(16);
  await page.locator(".degree-overview > .hint").scrollIntoViewIfNeeded();
  await noOverlap(page);
  await shot(page, "degree-rules-320");
  const inset = await page
    .locator(".degree-modal .modal-content")
    .evaluate((e) => {
      const s = getComputedStyle(e);
      return { right: parseFloat(s.paddingRight), overflow: s.overflowY };
    });
  expect(inset.right).toBeGreaterThanOrEqual(16);
  expect(inset.overflow).toBe("auto");
  await page.getByRole("button", { name: "制作分享卡", exact: true }).click();
  await page.getByRole("button", { name: "自己写一句" }).click();
  await page.getByLabel("自定义短句").fill("慢慢记录，也慢慢成长");
  await page.setViewportSize({ width: 320, height: 520 });
  await page.getByLabel("自定义短句").focus();
  await page.getByRole("button", { name: /预览卡片/ }).scrollIntoViewIfNeeded();
  await noOverlap(page);
  await expect(page.getByRole("button", { name: /预览卡片/ })).toBeInViewport();
});
test("体重半圆在深浅色中准确显示端点、渐变与普通字重", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("form-daily");
      q.onsuccess = () => r(q.result);
    });
    const profile = await new Promise<any>((r) => {
      const q = db.transaction("profile").objectStore("profile").get("local");
      q.onsuccess = () => r(q.result);
    });
    await new Promise<void>((r) => {
      const tx = db.transaction(["profile", "weights"], "readwrite");
      tx.objectStore("profile").put({
        ...profile,
        weightPlan: {
          id: "visual-test",
          startDate: "2026-10-01",
          targetDate: "2027-01-21",
          startKg: 78,
          targetKg: 68,
        },
      });
      tx.objectStore("weights").put({
        date: "2026-10-20",
        weightKg: 75,
        updatedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => r();
    });
    db.close();
  });
  await page.reload();
  const colours = [];
  for (const name of ["浅色", "深色"]) {
    await nav(page, "我的");
    await page.getByRole("button", { name, exact: true }).click();
    await nav(page, "今天");
    await page.getByRole("button", { name: "显示体重进度" }).click();
    const gauge = page.locator('.stack-slide[aria-hidden="false"] .lean-gauge');
    await expect(gauge).toHaveAttribute("data-progress", "30");
    const endpoint = await gauge
      .locator(".gauge-end circle")
      .last()
      .evaluate((e) => ({
        x: Number(e.getAttribute("cx")),
        y: Number(e.getAttribute("cy")),
      }));
    expect(endpoint.x).toBeCloseTo(120 - 100 * Math.cos(0.3 * Math.PI));
    expect(endpoint.y).toBeCloseTo(120 - 100 * Math.sin(0.3 * Math.PI));
    colours.push(
      await gauge.evaluate((e) =>
        getComputedStyle(e).getPropertyValue("--gauge-to"),
      ),
    );
    await shot(page, `weight-progress-${name}`);
    expect(
      await page
        .locator('.stack-slide[aria-hidden="false"] .plan-value strong')
        .first()
        .evaluate((e) => getComputedStyle(e).fontWeight),
    ).toBe("400");
  }
  expect(colours[0]).not.toBe(colours[1]);
});
