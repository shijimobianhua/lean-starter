import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
const artifacts = path.resolve("artifacts/v166-regression/eighth-update");
async function nav(p: Page, name: string) {
  await p
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name, exact: true })
    .click();
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
test("移动布局、输入字号、箭头、底栏和外部关闭", async ({ page }) => {
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByText("离线缓存已就绪", { exact: true })).toHaveCount(
    0,
  );
  expect(
    await page
      .locator(".bottom-nav")
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThan(76);
  const positions = await page
    .locator(".metric-button .entry-chevron")
    .evaluateAll((nodes) =>
      nodes.map((n) => Math.round(n.getBoundingClientRect().right)),
    );
  expect(new Set(positions).size).toBe(1);
  await page.screenshot({
    animations: "disabled",
    path: path.join(artifacts, "home-mobile-dark.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  let modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  expect(
    await modal
      .getByLabel("体重（kg）")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await page.mouse.click(2, 2);
  await expect(modal).toHaveCount(0);
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  modal = page.getByRole("dialog");
  await modal.getByLabel("体重（kg）").fill("65.5");
  await page.mouse.click(2, 2);
  await page
    .getByRole("dialog", { name: "请确认" })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "请确认" })).toHaveCount(0);
  modal = page.getByRole("dialog", { name: "体重记录", exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("体重（kg）")).toHaveValue("65.5");
  await page.mouse.click(2, 2);
  await page
    .getByRole("dialog", { name: "请确认" })
    .getByRole("button", { name: "放弃修改", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).not.toBe(
    "fixed",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).not.toHaveCSS("outline-style", "solid");
});
test("五张照片紧凑排布、最多选四张、单图缩放", async ({ page }) => {
  await page.getByRole("button", { name: /薄肌照片/ }).click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByLabel("照片日期", { exact: true })
      .fill("2026-10-" + String(i + 1).padStart(2, "0"));
    await page.getByLabel("上传薄肌照片").setInputFiles("public/icon-192.png");
    await expect(page.locator(".photo-card")).toHaveCount(i + 1);
  }
  const date = page.getByLabel("照片日期", { exact: true });
  const boxes = await date.evaluate((e) => {
    const p = e.closest(".panel")!.getBoundingClientRect(),
      r = e.getBoundingClientRect();
    return {
      inside: r.right <= p.right && r.left >= p.left,
      font: parseFloat(getComputedStyle(e).fontSize),
    };
  });
  expect(boxes.inside).toBe(true);
  expect(boxes.font).toBeGreaterThanOrEqual(16);
  const first = await page.locator(".photo-card").nth(0).boundingBox(),
    third = await page.locator(".photo-card").nth(4).boundingBox();
  expect(Math.abs(first!.y - third!.y)).toBeLessThan(2);
  await page.screenshot({
    animations: "disabled",
    path: path.join(artifacts, "photos-grid-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "照片对比", exact: true }).click();
  const picker = page.getByRole("dialog");
  for (const day of ["05", "04", "03", "02"]) {
    await picker.getByLabel("选择照片日期").selectOption("2026-10-" + day);
    await picker
      .getByRole("button", { name: /选择对比/ })
      .first()
      .click();
  }
  await picker.getByLabel("选择照片日期").selectOption("2026-10-01");
  await expect(picker.getByRole("button", { name: /选择对比/ })).toBeDisabled();
  await picker.getByRole("button", { name: /开始对比/ }).click();
  await expect(page.getByRole("dialog").locator(".comparison img")).toHaveCount(
    4,
  );
  await page.screenshot({
    animations: "disabled",
    path: path.join(artifacts, "compare-four-mobile.png"),
  });
  await page.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page
    .getByRole("button", { name: /^查看照片/ })
    .first()
    .click();
  const viewer = page.getByRole("dialog");
  await viewer.getByRole("button", { name: "放大照片" }).click();
  await expect(viewer.getByText("150%", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  await viewer.getByRole("button", { name: "复位", exact: true }).click();
  await expect(viewer.getByText("100%", { exact: true })).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(viewer).toHaveCount(0);
});
test("无需旋转手机的600天横向图表，关闭保留筛选", async ({ page }) => {
  const weights = Array.from({ length: 600 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 9, 17 - i)).toISOString().slice(0, 10),
    weightKg: 65 + (i % 10) / 10,
    updatedAt: new Date().toISOString(),
  }));
  const backup = {
    app: "FORM DAILY",
    version: 1,
    exportedAt: new Date().toISOString(),
    weights,
    water: [],
    sleep: [],
    photos: [],
    profile: { id: "local", heightCm: 175 },
  };
  await nav(page, "我的");
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "确认合并恢复" }).click();
  await expect(page.getByRole("status")).toContainText("备份已恢复");
  await nav(page, "趋势");
  await page.getByLabel("趋势日期范围", { exact: true }).selectOption("90");
  await page.getByLabel("显示 BMI", { exact: true }).check();
  await page.getByRole("button", { name: "横向查看" }).click();
  const modal = page.getByRole("dialog");
  await expect(
    modal.getByRole("button", { name: "全部", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(modal.getByText("600 天记录")).toBeVisible();
  expect(
    await modal
      .locator(".modal-content")
      .evaluate((e) => getComputedStyle(e).transform),
  ).toMatch(/matrix\(0, 1, -1, 0/);
  await expect(modal.locator(".recharts-line")).toHaveCount(2);
  await expect(modal).toHaveCSS("opacity", "1");
  await modal.getByLabel("显示 BMI", { exact: true }).uncheck();
  await expect(modal.locator(".recharts-line")).toHaveCount(1);
  await page.screenshot({
    animations: "disabled",
    path: path.join(artifacts, "wide-600-days-mobile.png"),
  });
  await modal.getByLabel("详细排布").check();
  expect(
    await modal
      .locator(".wide-chart-scroll")
      .evaluate((e) => e.scrollWidth > e.clientWidth),
  ).toBe(true);
  await modal.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByLabel("趋势日期范围", { exact: true })).toHaveValue(
    "90",
  );
  await expect(page.getByLabel("显示 BMI", { exact: true })).toBeChecked();
});
test("电脑端每日一句适配、英文翻译、当日固定和离线", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const card = page.getByLabel("每日一句", { exact: true });
  await expect(card).toHaveAttribute("aria-busy", "false");
  const original = (await card.textContent())!;
  expect(
    await card
      .locator("blockquote")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBe(27);
  await page.screenshot({
    animations: "disabled",
    path: path.join(artifacts, "home-desktop-dark.png"),
    fullPage: true,
  });
  await nav(page, "我的");
  await page.getByRole("button", { name: /每日一句 管理句库/ }).click();
  await page.getByRole("button", { name: "新增句子", exact: true }).click();
  await page.getByLabel("句子语言").selectOption("en");
  await page.getByLabel("句子正文").fill("Make room for a gentler day.");
  await page.getByLabel("中文翻译").fill("给温柔的一天留一点空间。");
  await expect(page.getByLabel("句子预览")).toContainText(
    "给温柔的一天留一点空间。",
  );
  await page.getByRole("button", { name: "添加句子", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "句子已保存",
  );
  await page.getByRole("button", { name: "关闭浮窗", exact: true }).click();
  await nav(page, "今天");
  await expect(card).toHaveText(original);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(card).toHaveAttribute("aria-busy", "false");
  await context.setOffline(true);
  await page.reload();
  await expect(card).toHaveText(original);
  await context.setOffline(false);
  await nav(page, "我的");
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  await nav(page, "今天");
  await page.screenshot({
    animations: "disabled",
    path: path.join(artifacts, "home-desktop-light.png"),
    fullPage: true,
  });
});
test("触屏照片双指缩放，页面不放大，减少动态效果无残留", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4165",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    timezoneId: "Asia/Shanghai",
    reducedMotion: "reduce",
  });
  try {
    const p = await context.newPage();
    await p.goto("/");
  await p.getByRole("button", {name:/普通使用版/}).click();
    await p.getByRole("button", { name: "男 薄肌", exact: true }).click();
    await p.getByRole("button", { name: "继续", exact: true }).click();
    await p.getByRole("button", { name: "继续", exact: true }).click();
    await p.getByRole("button", { name: "开始记录", exact: true }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await expect(
      p.getByRole("button", { name: "记录体重", exact: true }),
    ).toBeEnabled();
    await p.getByRole("button", { name: /薄肌照片/ }).tap();
    await p.getByLabel("上传薄肌照片").setInputFiles("public/icon-512.png");
    await expect(p.locator(".photo-card")).toHaveCount(1);
    await p.getByRole("button", { name: /^查看照片/ }).tap();
    const viewer = p.getByRole("dialog");
    await expect(viewer).toHaveCSS("opacity", "1");
    const r = await viewer.getByLabel("照片缩放区域").boundingBox();
    const x = r!.x + r!.width / 2,
      y = r!.y + r!.height / 2;
    const session = await context.newCDPSession(p);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 20, y, id: 1 },
        { x: x + 20, y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 60, y, id: 1 },
        { x: x + 60, y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        parseInt(
          (await viewer.locator(".zoom-tools>span").innerText()).replace(
            "%",
            "",
          ),
        ),
      )
      .toBeGreaterThan(100);
    expect(await p.evaluate(() => visualViewport?.scale ?? 1)).toBe(1);
    await p.getByRole("button", { name: "关闭浮窗" }).tap();
    await expect(viewer).toHaveCount(0);
    expect(await p.evaluate(() => document.body.style.position)).not.toBe(
      "fixed",
    );
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 100, y: 200, id: 1 },
        { x: 150, y: 200, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: 70, y: 200, id: 1 },
        { x: 190, y: 200, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(await p.evaluate(() => visualViewport?.scale ?? 1)).toBe(1);
  } finally {
    await context.close();
  }
});
