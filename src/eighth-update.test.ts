import { it, expect, beforeEach } from "vitest";
import { db, type TrainingEntry } from "./data";
import { trainingStreak } from "./Achievement";
import { parseQuotes, importQuotes, clearQuotes } from "./quote-import";
import { ensureDailyQuote } from "./quotes";
import { exportBackup, importBackup } from "./backup";
import { resetLocalData } from "./ResetPanel";
import {
  createCheckpoint,
  recoveryDb,
  getSetting,
  setSetting,
} from "./recovery";
import { shiftDate } from "./records";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
const train = (
  date: string,
  status: "trained" | "rest" = "trained",
): TrainingEntry => ({
  date,
  status,
  aerobic: status === "trained" ? "跑步" : "",
  anaerobic: "",
  updatedAt: date + "T12:00:00Z",
});
it("百日训练按日期去重、忽略未来；今天未结束不提前中断", () => {
  const today = "2026-10-18",
    rows = Array.from({ length: 100 }, (_, i) =>
      train(shiftDate(today, -i - 1)),
    );
  const s = trainingStreak([...rows, rows[0], train("2026-10-19")], today);
  expect(s).toEqual({ current: 100, best: 100, passed: true });
  expect(trainingStreak([...rows, train(today, "rest")], today).current).toBe(
    0,
  );
  expect(
    trainingStreak(
      rows.filter((r) => r.date !== shiftDate(today, -2)),
      today,
    ).current,
  ).toBe(1);
});
it("昨天休息和漏打中断；今天实际训练重新开始", () => {
  const today = "2026-10-18";
  expect(
    trainingStreak(
      [train(shiftDate(today, -2)), train(shiftDate(today, -1), "rest")],
      today,
    ).current,
  ).toBe(0);
  expect(
    trainingStreak([train(shiftDate(today, -2)), train(today)], today).current,
  ).toBe(1);
});
it("TXT和粘贴格式识别中英、翻译、出处并报告重复和错误", () => {
  const rows = parseQuotes(
    "\uFEFF中文一句 | | 我的收藏\nStay curious.\t保持好奇。\t作者\n中文一句\nHello\n",
  );
  expect(rows).toHaveLength(4);
  expect(rows[1].value.language).toBe("en");
  expect(rows[1].value.translation).toBe("保持好奇。");
  expect(rows[2].duplicate).toBe(true);
  expect(rows[3].error).toContain("翻译");
});
it("批量导入先整批校验，失败不部分写入，重复正文去重", async () => {
  const a = {
    language: "zh" as const,
    text: "一点点向前",
    translation: "",
    source: "自己",
  };
  await expect(importQuotes([a, { ...a, text: "" }])).rejects.toThrow();
  expect(await db.quotes.count()).toBe(0);
  await importQuotes([a, a]);
  expect(await db.quotes.count()).toBe(1);
});
it("清空句库包括当天缓存，不重填内置，不影响身体记录；备份可保留空句库", async () => {
  await db.weights.put({
    date: "2026-10-18",
    weightKg: 70,
    updatedAt: "2026-10-18T10:00:00Z",
  });
  await ensureDailyQuote();
  await clearQuotes();
  expect(await db.weights.count()).toBe(1);
  expect(await db.quotes.count()).toBe(0);
  expect((await db.profile.get("local"))?.hiddenQuotes).toHaveLength(60);
  expect(await ensureDailyQuote()).toBeUndefined();
  const b = await exportBackup();
  await importBackup(b);
  expect(await ensureDailyQuote()).toBeUndefined();
});
it("主动清空句库不会被误判成丢失历史而自动要求恢复", async () => {
  await importQuotes([
    { language: "zh", text: "一句", translation: "", source: "" },
  ]);
  const row = await createCheckpoint("before");
  await clearQuotes();
  expect(await getSetting("ignored-recovery")).toBe(row?.id);
});
it("做空回调清除全部主表、恢复副本、设置和关联，但不调用文件删除", async () => {
  await db.weights.put({
    date: "2026-10-18",
    weightKg: 70,
    updatedAt: "2026-10-18T10:00:00Z",
  });
  await db.profile.put({ id: "local", onboardingDone: true, gender: "female" });
  await createCheckpoint("before");
  await setSetting("test", "value");
  localStorage.setItem("form-theme", "dark");
  localStorage.setItem("daily-last-record-count", "1");
  await resetLocalData();
  expect(await db.weights.count()).toBe(0);
  expect(await db.profile.count()).toBe(0);
  expect(await recoveryDb.checkpoints.count()).toBe(0);
  expect(await recoveryDb.settings.count()).toBe(0);
  expect(localStorage.getItem("form-theme")).toBeNull();
  expect(localStorage.getItem("daily-last-record-count")).toBeNull();
});
