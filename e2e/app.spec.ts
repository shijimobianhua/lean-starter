import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
const artifacts = path.resolve("artifacts/v166-regression/eighth-update");
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function editor(page: Page, kind: string) {
  await page.getByRole("button", { name: "记录" + kind, exact: true }).click();
  return page.getByRole("dialog");
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await fs.mkdir(artifacts, { recursive: true });
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  await expect(
    page.getByRole("dialog", { name: "欢迎使用 薄肌 LEAN" }),
  ).toBeVisible();
  {
    await page.getByRole("button", { name: "男", exact: false }).click();
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await page.getByRole("button", { name: "开始记录", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "欢迎使用 薄肌 LEAN" }),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toBeEnabled();
});
test("320px深色界面、四卡、日历与浅色切换", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim(),
    ),
  ).toBe("#d4bc91");
  await noOverflow(page);
  await page.screenshot({
    path: path.join(artifacts, "home-dark.png"),
    fullPage: true,
  });
  for (const kind of ["大水", "大睡", "薄肌", "体重"]) {
    const dialog = await editor(page, kind);
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await dialog.getByRole("button", { name: "关闭记录" }).click();
  }
  await nav(page, "日历");
  await noOverflow(page);
  await page.screenshot({
    path: path.join(artifacts, "calendar-dark.png"),
    fullPage: true,
  });
  await nav(page, "我的");
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await noOverflow(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("真实记录、BMI开关和备份恢复", async ({ page, browser }) => {
  let d = await editor(page, "体重");
  await d.getByLabel("体重（kg）").fill("64.2");
  await d.getByRole("button", { name: "保存体重" }).click();
  await expect(
    page
      .getByRole("button", { name: "记录体重", exact: true })
      .locator(".metric-value"),
  ).toContainText("64.2");
  d = await editor(page, "大水");
  await d.getByRole("button", { name: "早上", exact: true }).click();
  await d.getByRole("button", { name: "+0.2 大水", exact: true }).click();
  await d.getByRole("button", { name: "中午", exact: true }).click();
  await d.getByRole("button", { name: "+0.5 大水", exact: true }).click();
  await d.getByRole("button", { name: "保存大水" }).click();
  await expect(
    page
      .getByRole("button", { name: "记录大水", exact: true })
      .locator(".metric-value"),
  ).toContainText("0.70");
  d = await editor(page, "大睡");
  await d.getByLabel("入睡时分").fill("23:30");
  await d.getByLabel("起床时分").fill("07:30");
  await expect(d.getByText("共 8.0 小时")).toBeVisible();
  await d.getByRole("button", { name: "保存大睡" }).click();
  d = await editor(page, "薄肌");
  await d.getByRole("button", { name: "添加训练", exact: false }).click();
  const exercise = page.getByRole("dialog", { name: "添加训练", exact: true });
  await exercise.getByLabel("搜索运动").fill("慢跑");
  await exercise.getByRole("button", { name: /慢跑 有氧/ }).click();
  const detail = page.getByRole("dialog", { name: "训练详情", exact: true });
  await detail.getByLabel("时长（分钟）").fill("30");
  await detail
    .getByRole("button", { name: "添加到当天训练", exact: true })
    .click();
  await d.getByRole("button", { name: "保存薄肌" }).click();
  await expect(page.getByText("今日已练", { exact: true })).toBeVisible();
  await nav(page, "我的");
  await page.getByRole("button", {name:/身体资料/}).click();
  await page.getByLabel("身高（cm）").fill("175");
  await page.getByRole("button", { name: "保存身体资料" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "趋势");
  await expect(page.getByLabel("显示 BMI")).not.toBeChecked();
  await expect(page.locator(".recharts-line")).toHaveCount(1);
  await page.getByLabel("显示 BMI").check();
  await expect(page.locator(".recharts-line")).toHaveCount(2);
  await noOverflow(page);
  await page.screenshot({
    path: path.join(artifacts, "weight-bmi-dark.png"),
    fullPage: true,
  });
  await page.getByLabel("显示 BMI").uncheck();
  await expect(page.locator(".recharts-line")).toHaveCount(1);
  await nav(page, "我的");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  const download = await downloadPromise;
  const backupPath = path.join(artifacts, "browser-backup.json");
  await download.saveAs(backupPath);
  const backup = JSON.parse(await fs.readFile(backupPath, "utf8"));
  expect(backup.version).toBe(4);
  expect(backup.training[0].items[0].name).toBe("慢跑");
  expect(backup.training[0].items[0].minutes).toBe(30);
  const fresh = await browser.newContext({
    baseURL: "http://127.0.0.1:4165",
    viewport: { width: 320, height: 740 },
    timezoneId: "Asia/Shanghai",
  });
  try {
    const restore = await fresh.newPage();
    await restore.goto("/");
  await restore.getByRole("button", {name:/普通使用版/}).click();
    await restore.getByRole("button", { name: "男 薄肌", exact: true }).click();
    await restore.getByRole("button", { name: "继续", exact: true }).click();
    await restore.getByRole("button", { name: "继续", exact: true }).click();
    await restore
      .getByRole("button", { name: "开始记录", exact: true })
      .click();
    await expect(restore.getByRole("dialog")).toHaveCount(0);
    await expect(
      restore.getByRole("button", { name: "记录体重", exact: true }),
    ).toBeEnabled();
    await nav(restore, "我的");
    await restore.getByLabel("选择备份文件").setInputFiles(backupPath);
    await restore.getByRole("button", { name: "确认合并恢复" }).click();
    await expect(restore.getByRole("status")).toContainText("备份已恢复");
    await nav(restore, "今天");
    await expect(
      restore
        .getByRole("button", { name: "记录体重", exact: true })
        .locator(".metric-value"),
    ).toContainText("64.2");
    await expect(restore.getByText("今日已练", { exact: true })).toBeVisible();
  } finally {
    await fresh.close();
  }
});
test("离线冷启动、记录和趋势分包可用", async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toBeEnabled();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toBeEnabled();
  const d = await editor(page, "体重");
  await d.getByLabel("体重（kg）").fill("67");
  await d.getByRole("button", { name: "保存体重" }).click();
  await expect(
    page
      .getByRole("button", { name: "记录体重", exact: true })
      .locator(".metric-value"),
  ).toContainText("67");
  await nav(page, "趋势");
  await expect(page.getByRole("heading", { name: "体重趋势" })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: "记录体重", exact: true })
      .locator(".metric-value"),
  ).toContainText("67");
  await context.setOffline(false);
});
test("照片本地压缩、双图对比和导出", async ({ page }) => {
  await page.getByRole("button", { name: /把变化，交给时间/ }).click();
  const upload = page.getByLabel("上传薄肌照片");
  await upload.setInputFiles("public/icon-192.png");
  await expect(page.locator(".photo-card")).toHaveCount(1);
  await page.getByLabel("照片日期", { exact: true }).fill("2026-10-01");
  await upload.setInputFiles("public/icon-512.png");
  await expect(page.locator(".photo-card")).toHaveCount(2);
  await page.getByRole("button", { name: "照片对比", exact: true }).click();
  const picker = page.getByRole("dialog");
  await picker
    .getByRole("button", { name: /选择对比/ })
    .first()
    .click();
  await picker.getByLabel("选择照片日期").selectOption("2026-10-01");
  await picker
    .getByRole("button", { name: /选择对比/ })
    .first()
    .click();
  await picker.getByRole("button", { name: /开始对比/ }).click();
  await expect(page.locator(".comparison img")).toHaveCount(2);
  await page.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await noOverflow(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /薄肌照片 · 2 张/ }),
  ).toBeVisible();
  await nav(page, "我的");
  const p = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  const download = await p;
  const backupPath = path.join(artifacts, "photos-backup.json");
  await download.saveAs(backupPath);
  const b = JSON.parse(await fs.readFile(backupPath, "utf8"));
  expect(b.photos).toHaveLength(2);
  expect(
    b.photos.every(
      (photo: { type: string; base64: string }) =>
        photo.type === "image/jpeg" && photo.base64.length > 0,
    ),
  ).toBe(true);
});
