import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166";
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
test.beforeAll(async () => {
  await fs.mkdir(out, { recursive: true });
});
for (const platform of ["ios", "android"]) {
  test(platform + " 连续折叠无闪断和学位规则卡片抖动", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    await page.evaluate(
      (p) => (document.documentElement.dataset.platform = p),
      platform,
    );
    await nav(page, "我的");
    await page.getByRole("button", { name: /薄肌学士学位考核/ }).click();
    const d = page.getByRole("dialog", { name: "我的薄肌学位", exact:true });
    await expect(d).toHaveCSS("opacity", "1");
    await d.evaluate((e) =>
      Promise.all(e.getAnimations().map((a) => a.finished)),
    );
    const before = (await d.boundingBox())!,
      toggle = d.getByRole("button", { name: /查看规则/ });
    const samples = await toggle.evaluate(async (el) => {
      const values: number[] = [];
      for (let i = 0; i < 17; i++) {
        (el as HTMLElement).click();
        await new Promise((r) => setTimeout(r, 25));
        const svg = el.querySelector("svg")!;
        values.push(svg.getBoundingClientRect().width);
      }
      return values;
    });
    expect(Math.min(...samples)).toBeGreaterThan(8);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(600);
    const after = (await d.boundingBox())!;
    expect(Math.abs(before.y - after.y)).toBeLessThan(2);
    expect(Math.abs(before.height - after.height)).toBeLessThan(2);
    expect(
      await d.evaluate(
        (e) =>
          e
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
    ).toBe(0);
    await page.screenshot({
      path: out + "/" + platform + "-logs.png",
      animations: "disabled",
    });
  });
  test(
    platform + " 搜索和键盘保持尺寸、分类与自定义入口不重叠",
    async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await start(page);
      await page.evaluate(
        (p) => (document.documentElement.dataset.platform = p),
        platform,
      );
      const navY = (await page.getByRole("navigation").boundingBox())!.y;
      await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /添加训练/ })
        .click();
      const d = page.getByRole("dialog", { name: "添加训练", exact: true });
      await expect(d).toHaveCSS("opacity", "1");
      await d.evaluate((e) =>
        Promise.all(e.getAnimations().map((a) => a.finished)),
      );
      const before = (await d.boundingBox())!;
      const field = d.getByLabel("搜索运动");
      await field.focus();
      await page.evaluate(() => {
        Object.defineProperty(visualViewport!, "height", {
          value: 420,
          configurable: true,
        });
        visualViewport!.dispatchEvent(new Event("resize"));
      });
      await expect(d).toHaveAttribute("data-keyboard", "true");
      expect(
        Math.abs((await d.boundingBox())!.height - before.height),
      ).toBeLessThan(3);
      await expect(field).toHaveCSS("outline-style", "none");
      expect((await page.getByRole("navigation").boundingBox())!.y).toBeCloseTo(
        navY,
        0,
      );
      await page.evaluate(() => {
        delete (visualViewport as unknown as { height?: number }).height;
        visualViewport!.dispatchEvent(new Event("resize"));
      });
      await field.blur();
      await field.fill("跑步机爬坡");
      await expect(d.locator(".exercise-result")).toHaveCount(1);
      await field.fill("");
      const cat = (await d.locator(".exercise-categories").boundingBox())!,
        custom = (await d
          .getByRole("button", { name: /＋ 自定义运动/ })
          .boundingBox())!;
      expect(cat.y + cat.height).toBeLessThanOrEqual(custom.y + 1);
      await d
        .locator(".exercise-categories")
        .evaluate((e) => (e.scrollTop = e.scrollHeight));
      await page.screenshot({
        path: out + "/" + platform + "-exercise.png",
        animations: "disabled",
      });
      for (let i = 0; i < 5; i++) {
        await d.getByLabel("搜索运动").fill("慢跑");
        await d.getByRole("button", { name: /慢跑 有氧/ }).click();
        await page
          .getByRole("dialog", { name: "训练详情" })
          .getByRole("button", { name: "返回运动列表", exact: true })
          .click();
      }
      expect(
        await d.evaluate(
          (e) =>
            e
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
      ).toBeLessThan(5);
    },
  );
}
test("方案条件显示、单位换算、隐藏记忆与紧凑日历和照片并排", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await expect(page.locator(".home-stack")).toHaveCount(0);
  const original = (await page
    .getByLabel("每日一句", { exact: true })
    .boundingBox())!.height;
  await nav(page, "我的");
  await expect(
    page.getByRole("heading", { name: "体重单位", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "体重管理方案", exact: false })
    .click();
  let d = page.getByRole("dialog", { name: "体重管理方案", exact: true });
  await d.getByLabel("初始体重（kg）").fill("75");
  await d.getByLabel("目标体重（kg）").fill("65");
  await d.getByRole("button", { name: "斤", exact: true }).click();
  await expect(d.getByLabel("初始体重（斤）")).toHaveValue("150");
  await d.getByRole("button", { name: "保存方案", exact: true }).click();
  await expect(d).toHaveCount(0);
  await nav(page, "今天");
  await expect(page.locator(".home-stack")).toHaveCount(1);
  expect(
    Math.abs(
      (await page.locator(".stack-window").boundingBox())!.height - original,
    ),
  ).toBeLessThan(3);
  await page.getByRole("button", { name: "显示体重进度" }).click();
  await expect(page.locator(".weight-progress")).toHaveCSS(
    "background-color",
    "rgb(41, 39, 36)",
  );
  await page.getByRole("button", { name: "编辑卡片" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("体重管理进度").uncheck();
  await d.getByRole("button", { name: "保存卡片" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "显示体重进度" })).toHaveCount(
    0,
  );
  await nav(page, "日历");
  const sizes = await page
    .locator(".calendar-day")
    .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
  expect(Math.max(...sizes)).toBeLessThanOrEqual(74);
  expect(Math.min(...sizes)).toBeGreaterThan(65);
  await page.screenshot({
    path: out + "/calendar-compact.png",
    animations: "disabled",
  });
  await nav(page, "趋势");
  await page.getByRole("button", { name: "薄肌", exact: true }).click();
  const buttons = page.locator(".photo-capture-actions .upload-button"),
    a = (await buttons.nth(0).boundingBox())!,
    b = (await buttons.nth(1).boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(a.x + a.width).toBeLessThan(b.x);
  await page.screenshot({
    path: out + "/photos-inline.png",
    animations: "disabled",
  });
});

test("大小卡片反复反向切换后无动画积压", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.evaluate((e) =>
    Promise.all(e.getAnimations().map((a) => a.finished)),
  );
  await d.evaluate(async (e) => {
    for (let i = 0; i < 21; i++) {
      const b = [...e.querySelectorAll("button")].find(
        (x) => x.textContent === (i % 2 ? "今天练了" : "今日休息"),
      );
      b?.click();
      await new Promise((r) => setTimeout(r, 20));
    }
  });
  await expect(
    d.getByRole("button", { name: "今日休息", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(750);
  expect(
    await d.evaluate(
      (e) =>
        e
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === "running").length,
    ),
  ).toBe(0);
  const b = (await d.boundingBox())!;
  expect(b.height).toBeLessThan(400);
  await page.screenshot({
    path: out + "/rapid-card-settled.png",
    animations: "disabled",
  });
});

test("触屏卡片全区域上下切换，卡片外正常滚动且没有固定箭头区", async ({
  browser,
}) => {
  const c = await browser.newContext({
    baseURL: "http://127.0.0.1:4165",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const p = await c.newPage();
    await start(p);
    await nav(p, "我的");
    await p.getByRole("button", { name: "体重管理方案", exact: false }).click();
    const d = p.getByRole("dialog");
    await d.getByLabel("初始体重（kg）").fill("75");
    await d.getByLabel("目标体重（kg）").fill("65");
    await d.getByRole("button", { name: "保存方案" }).click();
    await expect(d).toHaveCount(0);
    await nav(p, "今天");
    const client = await c.newCDPSession(p);
    async function touch(x: number, y: number, dx: number, dy: number) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 12; i++) {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * i) / 12, y: y + (dy * i) / 12 }],
        });
        await p.waitForTimeout(16);
      }
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    let box = (await p.locator(".stack-window").boundingBox())!;
    await touch(box.x + box.width / 2, box.y + box.height * 0.7, 0, -90);
    await expect(
      p.getByRole("button", { name: "显示体重进度" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await p.evaluate(() => scrollY)).toBeLessThan(5);
    await expect(p.locator(".stack-swipe-handle")).toHaveCount(0);
    await p.waitForTimeout(650);
    await touch(box.x + box.width / 2, box.y + box.height * 0.3, 0, 90);
    await expect(
      p.getByRole("button", { name: "显示每日一句" }),
    ).toHaveAttribute("aria-pressed", "true");
    const card = (await p
      .getByRole("button", { name: "记录大水", exact: true })
      .boundingBox())!;
    await touch(card.x + card.width / 2, card.y + card.height / 2, 0, -100);
    await expect.poll(() => p.evaluate(() => scrollY)).toBeGreaterThan(15);
    await p.screenshot({
      path: out + "/touch-stack.png",
      animations: "disabled",
    });
    await c.close();
  } catch (e) {
    await c.close();
    throw e;
  }
});
