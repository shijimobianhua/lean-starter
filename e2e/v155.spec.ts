import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-specific";
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
for (const platform of ["ios", "android"]) {
  test(
    platform + " 320与390宽进度文字不重叠，字体层级统一，快速切卡稳定",
    async ({ page }) => {
      await fs.mkdir(out, { recursive: true });
      await page.emulateMedia({ colorScheme: "light" });
      await page.setViewportSize({ width: 390, height: 844 });
      await start(page);
      await page.evaluate(
        (p) => (document.documentElement.dataset.platform = p),
        platform,
      );
      await page.getByRole("button", { name: "记录体重", exact: true }).click();
      let d = page.getByRole("dialog");
      await d.getByLabel("体重（kg）").fill("77");
      await d.getByRole("button", { name: "保存体重", exact: true }).click();
      await expect(d).toHaveCount(0);
      await nav(page, "我的");
      await page
        .getByRole("button", { name: "体重管理方案", exact: false })
        .click();
      d = page.getByRole("dialog");
      await d.getByLabel("初始体重（kg）").fill("75");
      await d.getByLabel("目标体重（kg）").fill("60");
      await d.getByRole("button", { name: "保存方案" }).click();
      await expect(d).toHaveCount(0);
      await nav(page, "今天");
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.getByRole("button", { name: "显示体重进度" }).click();
        await page.waitForTimeout(700);
        await expect(page.locator(".progress-gauge small")).toContainText(
          "已增",
        );
        const layout = await page.locator(".weight-progress").evaluate((el) => {
          const outer = el.getBoundingClientRect();
          const nodes = [
            ...el.querySelectorAll(
              ".section-heading,.plan-summary,.plan-current,.hint",
            ),
          ];
          const boxes = nodes.map((n) => n.getBoundingClientRect());
          const gauge = el
            .querySelector(".progress-gauge")!
            .getBoundingClientRect();
          const label = el
            .querySelector(".progress-gauge>div")!
            .getBoundingClientRect();
          return {
            overlap: boxes.some(
              (r, i) => i > 0 && r.top < boxes[i - 1].bottom - 1,
            ),
            inside: boxes.every(
              (r) => r.top >= outer.top && r.bottom <= outer.bottom + 1,
            ),
            gaugeInside:
              label.top >= gauge.top && label.bottom <= gauge.bottom + 1,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(layout).toEqual({
          overlap: false,
          inside: true,
          gaugeInside: true,
          overflow: false,
        });
        await page.screenshot({
          path: `${out}/${platform}-${width}-weight.png`,
          animations: "disabled",
        });
      }
      await page.evaluate(() => {
        const b = [
          ...document.querySelectorAll<HTMLButtonElement>(
            ".stack-controls button[aria-pressed]",
          ),
        ];
        for (let i = 0; i < 31; i++) b[i % 2].click();
      });
      await page.waitForTimeout(700);
      await expect(
        page.getByRole("button", { name: "显示每日一句" }),
      ).toHaveAttribute("aria-pressed", "true");
      await nav(page, "我的");
      const sizes = await page
        .locator(".settings-entry,.quote-entry")
        .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).fontSize));
      expect(new Set(sizes).size).toBe(1);
    },
  );
}
test("方案和训练详情刷新后可恢复草稿，确认放弃后不再恢复", async ({ page }) => {
  await start(page);
  await nav(page, "我的");
  await page
    .getByRole("button", { name: "体重管理方案", exact: false })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("初始体重（kg）").fill("75");
  await d.getByLabel("目标体重（kg）").fill("63");
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await nav(page, "我的");
  await page
    .getByRole("button", { name: "体重管理方案", exact: false })
    .click();
  d = page.getByRole("dialog");
  await expect(d.getByLabel("目标体重（kg）")).toHaveValue("63");
  await expect(d.getByRole("status")).toContainText("恢复");
  await d.getByRole("button", { name: "关闭浮窗" }).click();
  await page.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "今天");
  await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /添加训练/ })
    .click();
  d = page.getByRole("dialog", { name: "添加训练", exact: true });
  await d.getByPlaceholder("输入运动名称").fill("跑步机爬坡");
  await d
    .getByRole("button", { name: /跑步机爬坡/ })
    .first()
    .click();
  d = page.getByRole("dialog", { name: "训练详情", exact: true });
  await d.getByLabel("时长（分钟）").fill("35");
  await d.getByLabel("坡度（%）").fill("10");
  await page.reload();
  await page.getByRole("button", { name: "记录薄肌", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /添加训练/ })
    .click();
  d = page.getByRole("dialog", { name: "训练详情", exact: true });
  await expect(d.getByLabel("时长（分钟）")).toHaveValue("35");
  await expect(d.getByLabel("坡度（%）")).toHaveValue("10");
});
