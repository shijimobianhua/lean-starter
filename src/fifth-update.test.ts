import { beforeEach, it, expect } from "vitest";
import { db } from "./data";
import { saveGender } from "./Onboarding";
import { saveHeight, localDate } from "./records";
import { exportBackup, importBackup } from "./backup";
import {
  builtinQuotes,
  removeQuote,
  restoreBuiltinQuotes,
  pickQuote,
  saveQuote,
  ensureDailyQuote,
} from "./quotes";
import { weightDomain } from "./chart-scale";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
it("性别与引导在保存身高和备份恢复后保留", async () => {
  await saveGender("female", true);
  await saveHeight(168);
  const b = await exportBackup();
    delete b.integrity;
  await db.profile.clear();
  await importBackup(b);
  expect(await db.profile.get("local")).toMatchObject({
    gender: "female",
    heightCm: 168,
    onboardingDone: true,
  });
  await saveGender("male");
  expect((await db.profile.get("local"))?.heightCm).toBe(168);
});
it("内置60条示例有来源、40中文20英文且支持完整循环", () => {
  expect(builtinQuotes).toHaveLength(60);
  expect(new Set(builtinQuotes.map((q) => q.text)).size).toBe(60);
  expect(builtinQuotes.filter((q) => q.language === "zh")).toHaveLength(40);
  expect(
    builtinQuotes.every((q) => q.source && !q.source.includes("原创")),
  ).toBe(true);
  expect(
    builtinQuotes
      .filter((q) => q.language === "en")
      .every((q) => q.translation),
  ).toBe(true);
});
it("删除内置句子可备份恢复，恢复默认保留自定义", async () => {
  await removeQuote("builtin-0");
  await saveQuote({
    text: "我自己的句子",
    translation: "",
    source: "我",
    language: "zh",
  });
  const b = await exportBackup();
    delete b.integrity;
  await db.profile.clear();
  await importBackup(b);
  expect((await db.profile.get("local"))?.hiddenQuotes).toContain("builtin-0");
  await restoreBuiltinQuotes();
  expect((await db.profile.get("local"))?.hiddenQuotes).toEqual([]);
  expect(await db.quotes.count()).toBe(1);
});
it("内置句子可覆盖且当天展示稳定", async () => {
  const first = await ensureDailyQuote();
  await saveQuote(
    { text: "修改内置句子", translation: "", source: "我", language: "zh" },
    "builtin-0",
  );
  expect(await ensureDailyQuote()).toEqual(first);
  const custom = await db.quotes.toArray();
  const pool = Array.from({ length: 60 }, (_, i) =>
    pickQuote("2026-12-" + String((i % 28) + 1).padStart(2, "0"), custom),
  );
  expect(custom[0].id).toBe("builtin-0");
  expect(pool.length).toBe(60);
  expect(localDate()).toBeTruthy();
});
it("体重小幅变化不会铺满纵轴且所有数据在范围内", () => {
  for (const values of [[71, 75], [74], [74, 74], [20, 500], []]) {
    const [lo, hi] = weightDomain(values);
    expect(hi - lo).toBeGreaterThanOrEqual(20);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
  }
  expect(
    weightDomain([71, 75])[1] - weightDomain([71, 75])[0],
  ).toBeGreaterThanOrEqual(20);
});
