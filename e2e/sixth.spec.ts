import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-regression/eighth-update";
async function finish(p: Page) {
  await expect(
    p.getByRole("dialog", { name: "欢迎使用 薄肌 LEAN" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "女 马甲线", exact: true }).click();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await expect(p.getByText("Safari → 分享 → 添加到主屏幕")).toBeVisible();
  await p.getByRole("button", { name: "继续", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "重仓自己的身体", exact: true }),
  ).toBeVisible();
}
async function nav(p: Page, name: string) {
  await p
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test.beforeEach(async () => {
  await fs.mkdir(out, { recursive: true });
});
test("iOS安全区、主张居中、键盘和弹窗不移动导航、横向控件可点", async ({
  browser,
}) => {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    baseURL: "http://127.0.0.1:4165",
  });
  try {
    const p = await c.newPage();
    await p.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
    });
    await p.goto("/");
  await p.getByRole("button", {name:/普通使用版/}).click();
    await p.evaluate(() => {
      document.documentElement.style.setProperty("--safe-top", "59px");
      document.documentElement.style.setProperty("--safe-bottom", "34px");
    });
    await finish(p);
    await p
      .getByRole("heading", { name: "重仓自己的身体", exact: true })
      .evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)));
    await p.screenshot({
      path: out + "/ios-onboarding.png",
      animations: "disabled",
    });
    const r = await p
      .getByRole("heading", { name: "重仓自己的身体", exact: true })
      .boundingBox();
    expect(Math.abs(r!.x + r!.width / 2 - 195)).toBeLessThan(2);
    const stage = await p.locator(".onboarding-stage").boundingBox();
    expect(
      Math.abs(r!.y + r!.height / 2 - (stage!.y + stage!.height / 2)),
    ).toBeLessThan(3);
    await p.getByRole("button", { name: "开始记录", exact: true }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    const y = (await p.locator(".bottom-nav").boundingBox())!.y;
    await p.getByRole("button", { name: "记录大水", exact: true }).click();
    await expect(p.locator("html")).toHaveAttribute("data-modal-open", "true");
    expect((await p.locator(".bottom-nav").boundingBox())!.y).toBeCloseTo(y, 0);
    await p.evaluate(() => {
      Object.defineProperty(visualViewport!, "height", {
        value: 480,
        configurable: true,
      });
      Object.defineProperty(visualViewport!, "offsetTop", {
        value: 80,
        configurable: true,
      });
      visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(p.locator("html")).toHaveCSS("--visual-height", "480px");
    expect((await p.locator(".bottom-nav").boundingBox())!.y).toBeCloseTo(y, 0);
    await p.getByRole("button", { name: "关闭记录" }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await p.evaluate(() => {
      delete (visualViewport as unknown as { height?: number }).height;
      delete (visualViewport as unknown as { offsetTop?: number }).offsetTop;
      visualViewport!.dispatchEvent(new Event("resize"));
    });
    await nav(p, "趋势");
    const tab = await p
      .getByRole("button", { name: "大睡", exact: true })
      .boundingBox();
    expect(tab!.y).toBeGreaterThanOrEqual(40);
    await p.getByRole("button", { name: "大睡", exact: true }).click();
    await p.screenshot({
      path: out + "/ios-trends-safe.png",
      animations: "disabled",
    });
    await p.getByRole("button", { name: "横向查看" }).click();
    const m = p.getByRole("dialog");
    await expect(m).toHaveCSS("opacity", "1");
    const b = await m.locator(".modal-content").boundingBox();
    expect(b!.y).toBeGreaterThanOrEqual(71);
    expect(b!.y + b!.height).toBeLessThanOrEqual(810);
    for (const label of ["7天", "30天", "90天", "365天", "全部"]) {
      await m.getByRole("button", { name: label, exact: true }).click();
      await expect(
        m.getByRole("button", { name: label, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await p.screenshot({
      path: out + "/ios-wide-safe.png",
      animations: "disabled",
    });
    await m.getByRole("button", { name: "关闭浮窗" }).click();
    await expect(m).toHaveCount(0);
  } finally {
    await c.close();
  }
});
test("手机句子弹窗、未保存保护、内部滚动、英文排版与品牌图标", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  await finish(page);
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "我的");
  const y = (await page.locator(".bottom-nav").boundingBox())!.y;
  await page.getByRole("button", { name: /每日一句 管理句库/ }).click();
  const d = page.getByRole("dialog", { name: "每日一句", exact: true });
  await expect(d).toBeVisible();
  expect((await page.locator(".bottom-nav").boundingBox())!.y).toBeCloseTo(
    y,
    0,
  );
  await expect(d.locator(".quote-list article")).toHaveCount(60);
  await d.getByRole("button", { name: "新增句子", exact: true }).click();
  await d.getByLabel("句子语言").selectOption("en");
  await d.getByLabel("句子正文").fill("One small step at a time.");
  await d.getByLabel("中文翻译").fill("一步一步，慢慢向前。");
  await d.getByRole("button", { name: "关闭浮窗", exact: true }).click();
  await page
    .getByRole("dialog", { name: "请确认" })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(d.getByLabel("句子正文")).toHaveValue(
    "One small step at a time.",
  );
  await page.screenshot({
    path: out + "/quote-edit-mobile.png",
    animations: "disabled",
  });
  await d.getByRole("button", { name: "添加句子", exact: true }).click();
  await expect(d.locator(".quote-list article")).toHaveCount(61);
  await page.screenshot({
    path: out + "/quote-library-mobile.png",
    animations: "disabled",
  });
  await d.getByRole("button", { name: "关闭浮窗", exact: true }).click();
  await expect(d).toHaveCount(0);
  expect((await page.locator(".bottom-nav").boundingBox())!.y).toBeCloseTo(
    y,
    0,
  );
  await expect(page).toHaveTitle("薄肌 LEAN · 个人版");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.name).toBe("薄肌 LEAN · 个人版");
  expect(manifest.id).toBe("/");
  for (const icon of manifest.icons) {
    const response = await page.request.get(icon.src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");
  }
  const apple = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect((await page.request.get(apple!)).status()).toBe(200);
});
test("安卓横竖屏与桌面安全边界及放缓动画", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  await finish(page);
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "趋势");
  await page.getByRole("button", { name: "横向查看" }).click();
  const d = page.getByRole("dialog");
  await expect(d).toHaveCSS("opacity", "1");
  for (const size of [
    { width: 360, height: 780 },
    { width: 780, height: 360 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.locator("html")).toHaveCSS(
      "--visual-width",
      size.width + "px",
    );
    const r = await d.locator(".modal-content").boundingBox();
    expect(r!.x).toBeGreaterThanOrEqual(0);
    expect(r!.y).toBeGreaterThanOrEqual(0);
    expect(r!.x + r!.width).toBeLessThanOrEqual(size.width + 1);
    expect(r!.y + r!.height).toBeLessThanOrEqual(size.height + 1);
    expect(
      await d.getByRole("button", { name: "关闭浮窗" }).evaluate((e) => {
        const b = e.getBoundingClientRect();
        const target = document.elementFromPoint(
          b.x + b.width / 2,
          b.y + b.height / 2,
        );
        return target === e || e.contains(target);
      }),
    ).toBe(true);
    await d.getByRole("button", { name: "30天", exact: true }).click();
  }
  await d.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "今天");
  const duration = await page
    .getByRole("button", { name: "记录大水", exact: true })
    .evaluate((e) => getComputedStyle(e).transitionDuration);
  expect(duration).toContain("0.3s");
});

test("更新安装提示避开顶部、位于底栏上方且按钮可以点击", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  await finish(page);
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
  const prompt = page.getByLabel("应用更新与安装");
  const action = prompt.getByRole("button", { name: "安装到此设备" });
  await expect(action).toBeVisible();
  const r = await prompt.boundingBox(),
    navBox = await page.locator(".bottom-nav").boundingBox();
  expect(r!.y).toBeGreaterThan(24);
  expect(r!.y + r!.height).toBeLessThan(navBox!.y);
  await page.screenshot({
    path: out + "/update-install-placement.png",
    animations: "disabled",
  });
  await action.click();
  await expect(action).toHaveCount(0);
});
