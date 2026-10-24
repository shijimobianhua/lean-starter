import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-regression/eighth-update";
async function start(p: Page, female = false) {
  await p.goto("/");
  await expect(p.getByRole("dialog", {name:"欢迎使用 薄肌 LEAN"})).toBeVisible();
  if(await p.getByRole("button", {name:/普通使用版/}).isVisible()) await p.getByRole("button", {name:/普通使用版/}).click();
  await expect(
    p.getByRole("dialog", { name: "欢迎使用 薄肌 LEAN" }),
  ).toBeVisible();
  await p
    .getByRole("button", {
      name: female ? "女 马甲线" : "男 薄肌",
      exact: true,
    })
    .click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await expect(p.getByText("Safari → 分享 → 添加到主屏幕")).toBeVisible();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "重仓自己的身体" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
}
async function nav(p: Page, n: string) {
  await p
    .getByRole("navigation")
    .getByRole("button", { name: n, exact: true })
    .click();
}
test.beforeEach(async () => {
  await fs.mkdir(out, { recursive: true });
});
test("首次引导、女性名称、修改性别和刷新不重复", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  await expect(page.getByRole("heading", { name: "从你开始" })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: out + "/onboarding.png",
  });
  await start(page, true);
  await expect(
    page.getByRole("button", { name: "记录马甲线", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "记录马甲线", exact: true }).click();
  await expect(page.getByRole("heading", { name: "马甲线记录" })).toBeVisible();
  await page.getByRole("button", { name: "关闭记录" }).click();
  await nav(page, "趋势");
  await page.getByRole("button", { name: "马甲线", exact: true }).click();
  await expect(page.getByRole("heading", { name: "马甲线照片" })).toBeVisible();
  await nav(page, "我的");
  await page.getByRole("button", { name: "男", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "今天");
  await expect(
    page.getByRole("button", { name: "记录薄肌", exact: true }),
  ).toBeVisible();
});
test("底栏空数据位置稳定、紧凑大水、多时段保存和横向控件边界", async ({
  page,
}) => {
  await start(page);
  const y = (await page.locator(".bottom-nav").boundingBox())!.y;
  await page.screenshot({
    animations: "disabled",
    path: out + "/home-mobile.png",
  });
  await nav(page, "趋势");
  await page.getByRole("button", { name: "大睡", exact: true }).click();
  expect((await page.locator(".bottom-nav").boundingBox())!.y).toBeCloseTo(
    y,
    0,
  );
  await page.getByRole("button", { name: "横向查看" }).click();
  const m = page.getByRole("dialog");
  await expect(m).toBeVisible();
  await m.getByRole("button", { name: "7天", exact: true }).click();
  await expect(
    m.getByRole("button", { name: "7天", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await m.locator("select").count()).toBe(0);
  const bounds = await m.locator(".modal-content").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(741);
  await page.screenshot({
    animations: "disabled",
    path: out + "/wide-mobile.png",
  });
  await m.getByRole("button", { name: "关闭浮窗", exact: true }).click();
  await nav(page, "今天");
  await page.getByRole("button", { name: "记录大水", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "早上", exact: true }).click();
  await d.getByLabel("大水量").fill("0.2");
  await d.getByRole("button", { name: "中午", exact: true }).click();
  await d.getByLabel("大水量").fill("0.5");
  await d.getByRole("button", { name: "早上", exact: true }).click();
  await expect(d.getByLabel("大水量")).toHaveValue("0.2");
  await page.screenshot({
    animations: "disabled",
    path: out + "/water-mobile.png",
  });
  await d.getByRole("button", { name: "保存大水", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "记录大水", exact: true }),
  ).toContainText("1050 ml");
});
test("统一句库入口、编辑删除内置、添加英文翻译、离线", async ({
  page,
  context,
}) => {
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button", { name: /每日一句 管理句库/ }).click();
  await expect(page.locator(".quote-list article")).toHaveCount(60);
  await page
    .locator(".quote-list article")
    .first()
    .getByRole("button", { name: "编辑句子" })
    .click();
  await page.getByLabel("句子正文").fill("修改后的内置句子");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(page.locator(".quote-list")).toContainText("修改后的内置句子");
  await page
    .locator(".quote-list article")
    .last()
    .getByRole("button", { name: "删除句子" })
    .click();
  await page
    .getByRole("dialog", { name: "请确认" })
    .getByRole("button", { name: "删除句子", exact: true })
    .click();
  await expect(page.locator(".quote-list article")).toHaveCount(59);
  await page.getByRole("button", { name: "新增句子", exact: true }).click();
  await page.getByLabel("句子语言").selectOption("en");
  await page.getByLabel("句子正文").fill("My daily sentence.");
  await page.getByLabel("中文翻译").fill("我的每日一句。");
  await page.getByRole("button", { name: "添加句子", exact: true }).click();
  await expect(page.locator(".quote-list article")).toHaveCount(60);
  await page.screenshot({
    animations: "disabled",
    path: out + "/quotes-mobile.png",
  });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  await nav(page, "今天");
  await expect(page.getByLabel("每日一句", { exact: true })).toBeVisible();
  await context.setOffline(false);
});
