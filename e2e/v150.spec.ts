import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-regression/v150";
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
test.beforeEach(async () => {
  await fs.mkdir(out, { recursive: true });
});
test("斤输入、方案、首页卡片、重载和设置保留", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await nav(page, "我的");
  await page.getByRole("button",{name:"体重管理方案",exact:false}).click();
  await page.getByRole("button", { name: "斤", exact: true }).click();
  await page.getByRole("dialog").getByRole("button",{name:"关闭浮窗"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "今天");
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("体重（斤）").fill("150");
  await d.getByRole("button", { name: "保存体重", exact: true }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "我的");
  await page
    .getByRole("button", { name: "体重管理方案", exact: false })
    .click();
  d = page.getByRole("dialog", { name: "体重管理方案", exact: true });
  await expect(d.getByLabel("初始体重（斤）")).toHaveValue("150");
  await d.getByLabel("目标体重（斤）").fill("130");
  await d.getByRole("button", { name: "保存方案", exact: true }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "今天");
  await page.getByRole("button", { name: "显示体重进度", exact: true }).click();
  await expect(page.locator(".weight-progress")).toContainText("150");
  await page.screenshot({
    path: out + "/weight-plan-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "编辑卡片", exact: true }).click();
  d = page.getByRole("dialog", { name: "编辑首页卡片" });
  await d
    .locator(".widget-row")
    .filter({ hasText: "体重管理进度" })
    .getByRole("button", { name: "设为默认" })
    .click();
  await d.getByRole("button", { name: "保存卡片" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "显示体重进度" }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav(page, "我的");
  await page.getByRole("button",{name:"体重管理方案",exact:false}).click();
  await page.getByRole("button", { name: "kg", exact: true }).click();
  await page.getByRole("dialog").getByRole("button",{name:"关闭浮窗"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "今天");
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toContainText("75");
  await nav(page, "趋势");
  await expect(page.locator(".trend-summary")).toContainText("75.0");
  await expect(page.locator(".chart-legend")).toContainText("kg");
  await nav(page, "我的");
  await page.getByRole("button", { name: /风格选择/ }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /默认风格/ }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "关闭浮窗" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /更新日志/ })).toHaveCount(0);
  await expect(page.getByTestId("app-version")).toContainText("1.6.6");
  await page.screenshot({
    path: out + "/release-notes.png",
    animations: "disabled",
  });
});
test("训练搜索参数、自定义、未保存确认、日历统计和相机入口", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /添加训练/ })
    .click();
  let d = page.getByRole("dialog", { name: "添加训练", exact: true });
  await d.getByLabel("搜索运动").fill("跑步机爬坡");
  await d.getByRole("button", { name: /跑步机爬坡 有氧/ }).click();
  d = page.getByRole("dialog", { name: "训练详情", exact: true });
  await d.getByLabel("时长（分钟）").fill("40");
  await d.getByLabel("坡度（%）").fill("8");
  await d.getByLabel("速度（km/h）").fill("5");
  await page.screenshot({
    path: out + "/exercise-parameters.png",
    animations: "disabled",
  });
  await d.getByRole("button", { name: "添加到当天训练" }).click();
  await expect(d).toHaveCount(0);
  d = page.getByRole("dialog", { name: "薄肌记录" });
  await d.getByRole("button", { name: "关闭记录" }).click();
  await expect(page.getByRole("dialog", { name: "请确认" })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await d.getByRole("button", { name: "保存薄肌" }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "日历");
  await expect(page.locator(".day-detail")).toContainText("跑步机爬坡 40分钟");
  await expect(page.locator(".workout-stats")).toContainText("40 分钟");
  await page.screenshot({
    path: out + "/calendar-workouts.png",
    fullPage: true,
    animations: "disabled",
  });
  await nav(page, "趋势");
  await page.getByRole("button", { name: "薄肌", exact: true }).click();
  await expect(page.getByLabel("拍摄薄肌照片")).toHaveAttribute(
    "capture",
    "environment",
  );
  await expect(page.getByText("从相册选择", { exact: true })).toBeVisible();
  await page.screenshot({
    path: out + "/camera-album.png",
    animations: "disabled",
  });
});
test("iOS布局与键盘模拟保留卡片高度及固定底栏", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "ios";
    document.documentElement.dataset.standalone = "true";
  });
  await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /添加训练/ })
    .click();
  let d = page.getByRole("dialog", { name: "添加训练", exact: true });
  await d.getByLabel("搜索运动").fill("慢跑");
  await d.getByRole("button", { name: /慢跑 有氧/ }).click();
  d = page.getByRole("dialog", { name: "训练详情", exact: true });
  await expect(d).toHaveCSS("opacity", "1");
  await d.evaluate((e) =>
    Promise.all(e.getAnimations().map((a) => a.finished)),
  );
  const before = (await d.boundingBox())!,
    navY = (await page.getByRole("navigation").boundingBox())!.y;
  await d.getByLabel("备注").focus();
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      value: 420,
      configurable: true,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(d).toHaveAttribute("data-keyboard", "true");
  const after = (await d.boundingBox())!;
  expect(Math.abs(before.height - after.height)).toBeLessThan(3);
  expect(Math.abs(before.y - after.y)).toBeLessThanOrEqual(17);
  expect((await page.getByRole("navigation").boundingBox())!.y).toBeCloseTo(
    navY,
    0,
  );
  await page.screenshot({
    path: out + "/ios-keyboard-simulation.png",
    animations: "disabled",
  });
});

test("首页纵向跟手及小幅复位、自定义运动与完整备份", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await start(page);
  await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /添加训练/ })
    .click();
  let d = page.getByRole("dialog", { name: "添加训练", exact: true });
  await d.getByRole("button", { name: /自定义运动/ }).click();
  let c = page.getByRole("dialog", { name: "自定义运动" });
  await c.getByLabel("运动名称").fill("我的拉伸");
  await c.getByLabel("运动类型").selectOption("综合");
  await c.getByRole("button", { name: "创建并填写时长" }).click();
  d = page.getByRole("dialog", { name: "训练详情", exact: true });
  await d.getByLabel("时长（分钟）").fill("15");
  await d.getByRole("button", { name: "添加到当天训练" }).click();
  await expect(d).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "薄肌记录" })
    .getByRole("button", { name: "保存薄肌" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "我的");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  const file = await download;
  await file.saveAs(out + "/new-structured-backup.json");
  const b = JSON.parse(await fs.readFile((await file.path())!, "utf8"));
  expect(b.version).toBe(4);
  expect(b.training[0].items[0].name).toBe("我的拉伸");
  expect(b.training[0].items[0].minutes).toBe(15);
  expect(b.profile.customExercises[0].name).toBe("我的拉伸");
});
