import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-regression/eighth-update";
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  await page.getByRole("button", { name: "女 马甲线", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
test("固定安装入口、年月日直达、导航拖动和趋势双向滑动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const bar = page.getByRole("navigation"),
    a = (await bar
      .getByRole("button", { name: "今天", exact: true })
      .boundingBox())!,
    b = (await bar
      .getByRole("button", { name: "我的", exact: true })
      .boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(
    bar.getByRole("button", { name: "我的", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "安装与下载" })).toBeVisible();
  await page.getByRole("button", { name: "安装到电脑", exact: true }).click();
  await expect(page.getByRole("heading", { name: "安装指引" })).toBeVisible();
  await nav(page, "日历");
  await page.getByRole("button", { name: "选择年月日", exact: true }).click();
  await page.getByLabel("跳转日期").fill("2024-02-29");
  await page.getByRole("button", { name: "确认日期", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "2024-02-29 的日常" }),
  ).toBeVisible();
  await nav(page, "趋势");
  const empty = page.locator(".empty");
  await expect(empty).toBeVisible();
  const r = (await empty.boundingBox())!;
  const swipe = async (dx: number) => {
    await page.mouse.move(dx < 0 ? r.x + r.width - 35 : r.x + 35, r.y + 40);
    await page.mouse.down();
    await page.mouse.move(dx < 0 ? r.x + 35 : r.x + r.width - 35, r.y + 42, {
      steps: 12,
    });
    await page.mouse.up();
  };
  await swipe(-1);
  await expect(
    page.getByRole("button", { name: "大睡", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await swipe(1);
  await expect(
    page.getByRole("button", { name: "体重", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: out + "/navigation-and-trends.png",
    animations: "disabled",
  });
});
test("键盘遮盖卡片而不压缩、尺寸切换过渡、底栏冻结和输入选择例外", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const navY = (await page.getByRole("navigation").boundingBox())!.y;
  await page.getByRole("button", { name: "记录马甲线", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /添加训练/ })
    .click();
  const pick = page.getByRole("dialog", { name: "添加训练", exact: true });
  await pick.getByLabel("搜索运动").fill("慢跑");
  await pick.getByRole("button", { name: /慢跑 有氧/ }).click();
  const dialog = page.getByRole("dialog", { name: "训练详情", exact: true });
  await expect(dialog).toHaveCSS("opacity", "1");
  await dialog.evaluate((e) =>
    Promise.all(e.getAnimations().map((a) => a.finished)),
  );
  const field = dialog.locator("input").first(),
    before = (await dialog.boundingBox())!;
  await field.focus();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      value: 420,
      configurable: true,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(dialog).toHaveAttribute("data-keyboard", "true");
  const after = (await dialog.boundingBox())!;
  expect(Math.abs(after.height - before.height)).toBeLessThan(3);
  expect(after.y + after.height).toBeGreaterThan(420);
  expect((await page.getByRole("navigation").boundingBox())!.y).toBeCloseTo(
    navY,
    0,
  );
  await expect(field).toHaveCSS("user-select", "text");
  await expect(page.getByRole("navigation")).toHaveCSS("user-select", "none");
  await page.screenshot({
    path: out + "/keyboard-stable-card.png",
    animations: "disabled",
  });
  await page.evaluate(() => {
    delete (visualViewport as unknown as { height?: number }).height;
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await field.blur();
  await dialog.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(dialog).toHaveCount(0);
  const training = page.getByRole("dialog", { name: "马甲线记录" });
  await training.getByRole("button", { name: "今日休息", exact: true }).click();
  await training
    .getByRole("button", { name: "保存马甲线", exact: true })
    .click();
  await expect(training).toHaveCount(0);
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("马甲线已保存");
  const t = (await toast.boundingBox())!,
    n = (await page.getByRole("navigation").boundingBox())!;
  expect(t.y + t.height).toBeLessThan(n.y);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
  const install = page.getByLabel("应用更新与安装");
  await expect(
    install.getByRole("button", { name: "安装到此设备" }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const a = (await toast.boundingBox())!,
        b = (await install.boundingBox())!;
      return a.y + a.height <= b.y - 8;
    })
    .toBe(true);
  await page.screenshot({
    path: out + "/bottom-success-toast.png",
    animations: "disabled",
  });
});
test("TXT预览导入、清空二次确认与离线空句库保留", async ({ page, context }) => {
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button", { name: /每日一句 管理句库/ }).click();
  const d = page.getByRole("dialog", { name: "每日一句", exact: true });
  await d.getByRole("button", { name: "批量导入", exact: true }).click();
  await d.getByLabel("导入TXT句子").setInputFiles({
    name: "quotes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("自己的节奏 | | 自己\nKeep going. | 继续向前。 | 收藏"),
  });
  await expect(d.getByText(/可导入 2 句/)).toBeVisible();
  await d.getByRole("button", { name: "确认导入 2 句", exact: true }).click();
  await expect(d.locator(".quote-list article")).toHaveCount(62);
  await d.getByRole("button", { name: "删除所有句子", exact: true }).click();
  await page
    .getByRole("dialog", { name: "请确认" })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(d.locator(".quote-list article")).toHaveCount(62);
  await d.getByRole("button", { name: "删除所有句子", exact: true }).click();
  await page
    .getByRole("dialog", { name: "请确认" })
    .getByRole("button", { name: "删除全部句子", exact: true })
    .click();
  await expect(d.locator(".quote-list article")).toHaveCount(0);
  await d.getByRole("button", { name: "关闭浮窗", exact: true }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "今天");
  await expect(page.getByText(/句库为空/)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/句库为空/)).toBeVisible();
  await context.setOffline(false);
});
test("照片跨月定位与正倒序、独立对比，做空回调确认后回到欢迎页", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: /把变化，交给时间/ }).click();
  for (const date of ["2026-09-01", "2026-10-01", "2026-10-18"]) {
    await page.getByLabel("照片日期", { exact: true }).fill(date);
    await page
      .getByLabel("上传马甲线照片")
      .setInputFiles("public/icon-192.png");
  }
  await expect(page.locator(".photo-month")).toHaveCount(2);
  await page.getByLabel("照片排序").selectOption("asc");
  await expect(page.locator(".photo-month .disclosure-summary").first()).toContainText(
    "9月",
  );
  await page.getByLabel("定位照片日期").fill("2026-10-18");
  await page.getByRole("button", { name: "定位日期", exact: true }).click();
  await expect(page.locator(".photo-day-target")).toBeVisible();
  await page.getByRole("button", { name: "照片对比", exact: true }).click();
  const d = page.getByRole("dialog");
  for (const date of ["2026-09-01", "2026-10-18"]) {
    await d.getByLabel("选择照片日期").selectOption(date);
    await d.getByRole("button", { name: /选择对比/ }).click();
  }
  await d.getByRole("button", { name: /开始对比/ }).click();
  await expect(d.locator(".comparison img")).toHaveCount(2);
  await page.screenshot({
    path: out + "/month-photo-comparison.png",
    animations: "disabled",
  });
  await d.getByRole("button", { name: "返回选择" }).click();
  await expect(d.locator(".selected-photos button")).toHaveCount(2);
  await d.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "我的");
  await page.getByRole("button", { name: /做空回调/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /马甲线学士学位考核/ }).click();
  await expect(page.getByRole("dialog").locator(".degree-facts").getByText(/历史最长/)).toBeVisible();
  await page.getByRole("button", { name: "关闭浮窗" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /做空回调/ }).click();
  await page.getByRole("button", { name: "确认清空", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /是否开始/ }),
  ).toBeVisible();
});
