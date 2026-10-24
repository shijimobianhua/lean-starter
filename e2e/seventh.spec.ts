import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const out = "artifacts/v166-regression/eighth-update";
test("移动端去遮挡、引导标题居中、缩小提示与完整动画，恢复历史不重进引导", async ({
  page,
}) => {
  await fs.mkdir(out, { recursive: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", {name:/普通使用版/}).click();
  const h = page.getByRole("heading", { name: "从你开始", exact: true });
  await expect(h).toHaveCSS("text-align", "center");
  await page.getByRole("button", { name: "女 马甲线", exact: true }).click();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "让日常，随身", exact: true }),
  ).toHaveCSS("text-align", "center");
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.getByRole("button", { name: "开始记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "ios";
    document.documentElement.dataset.standalone = "true";
    document.documentElement.style.setProperty("--safe-top", "59px");
  });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.body, "::before").content,
    ),
  ).toBe("none");
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "我的", exact: true }).click();
  const backup = {
    app: "FORM DAILY",
    version: 3,
    exportedAt: new Date().toISOString(),
    weights: [
      { date: "2026-10-17", weightKg: 73, updatedAt: new Date().toISOString() },
      {
        date: "2026-10-18",
        weightKg: 73.5,
        updatedAt: new Date().toISOString(),
      },
    ],
    water: [
      { date: "2026-10-17", morningMl: 400, noonMl: 700, eveningMl: 400 },
      { date: "2026-10-18", morningMl: 450, noonMl: 700, eveningMl: 400 },
    ],
    sleep: [
      {
        wakeDate: "2026-10-17",
        startAt: "2026-10-16T23:00:00+08:00",
        endAt: "2026-10-17T07:00:00+08:00",
        timeZone: "Asia/Shanghai",
      },
      {
        wakeDate: "2026-10-18",
        startAt: "2026-10-17T23:00:00+08:00",
        endAt: "2026-10-18T07:06:00+08:00",
        timeZone: "Asia/Shanghai",
      },
    ],
    photos: [],
    training: [],
    quotes: [],
    dailyQuotes: [],
    profile: {
      id: "local",
      gender: "female",
      heightCm: 175,
      onboardingDone: true,
    },
  };
  // Keep relative-day assertions valid after midnight without freezing recovery timestamps.
  const relativeDates = await page.evaluate(() => {
    const result: Record<string,string> = {};
    for(const [label,offset] of [["2026-10-16",-2],["2026-10-17",-1],["2026-10-18",0]] as const) {
      const d=new Date();d.setDate(d.getDate()+offset);
      result[label]=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
    }
    return result;
  });
  const backupText=JSON.stringify(backup).replace(/2026-10-(16|17|18)/g,date=>relativeDates[date]);
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "test.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupText),
  });
  await page.getByRole("button", { name: "确认合并恢复" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "备份已恢复" }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "今天", exact: true }).click();
  const y = (await nav.boundingBox())!.y;
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d).toHaveCSS("animation-duration", "0.8s");
  expect((await nav.boundingBox())!.y).toBeCloseTo(y, 0);
  await page.getByRole("button", { name: "关闭记录", exact: true }).click();
  await expect(d).toHaveCSS("animation-duration", "0.55s");
  await expect(d).toHaveCount(0);
  await nav.getByRole("button", { name: "趋势", exact: true }).click();
  await page.getByLabel("显示 BMI", { exact: true }).check();
  const dot = page.locator(".recharts-line-dots circle").last();
  await dot.hover();
  await expect(page.locator(".chart-tooltip")).toBeVisible();
  await expect(page.locator(".chart-tooltip")).toHaveCSS("font-size", "12px");
  await expect(page.locator(".chart-legend")).toHaveCSS("font-size", "12px");
  await page.screenshot({
    path: out + "/compact-tooltip-mobile.png",
    animations: "disabled",
  });
  for (const kind of ["大睡", "大水"]) {
    await page.getByRole("button", { name: kind, exact: true }).click();
    await expect(page.locator(".chart")).toBeVisible();
    await page.screenshot({
      path:
        out + "/" + (kind === "大睡" ? "sleep" : "water") + "-scale-mobile.png",
      animations: "disabled",
    });
  }
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((r) => {
          const q = indexedDB.open("form-daily-recovery");
          q.onsuccess = () => r(q.result);
        });
        const result = await new Promise<number>((r) => {
          const q = db
            .transaction("checkpoints")
            .objectStore("checkpoints")
            .count();
          q.onsuccess = () => r(q.result);
        });
        db.close();
        return result;
      }),
    )
    .toBeGreaterThan(0);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open("form-daily");
      q.onsuccess = () => r(q.result);
    });
    const names = Array.from(db.objectStoreNames),
      tx = db.transaction(names, "readwrite");
    for (const n of names) tx.objectStore(n).clear();
    await new Promise<void>((r) => {
      tx.oncomplete = () => r();
    });
    db.close();
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "发现可恢复的历史记录" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "欢迎使用 薄肌 LEAN" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "恢复历史记录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "发现可恢复的历史记录" }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "今天", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "记录体重", exact: true }),
  ).toContainText("73.5");
});
