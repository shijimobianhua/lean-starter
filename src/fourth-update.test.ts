import { beforeEach, describe, it, expect } from "vitest";
import { db, FormDatabase } from "./data";
import Dexie from "dexie";
import {
  builtinQuotes,
  ensureDailyQuote,
  saveQuote,
  pickQuote,
  validateQuote,
} from "./quotes";
import { localDate, shiftDate, saveWeight } from "./records";
import { exportBackup, importBackup } from "./backup";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("每日一句与第四轮数据兼容", () => {
  it("60句以中文为主、英文都有翻译且60日循环", () => {
    expect(builtinQuotes).toHaveLength(60);
    expect(
      builtinQuotes.filter((q) => q.language === "zh").length,
    ).toBeGreaterThan(20);
    for (const q of builtinQuotes) {
      expect(() => validateQuote(q)).not.toThrow();
      if (q.language === "en") expect(q.translation).not.toBe("");
    }
    expect(pickQuote("2026-10-17", [])).toEqual(
      pickQuote(shiftDate("2026-10-17", 60), []),
    );
  });
  it("当天句子固定，个人增删改不改变当天缓存", async () => {
    const original = await ensureDailyQuote();
    await saveQuote({
      text: "慢慢向前。",
      translation: "",
      source: "我的句子",
      language: "zh",
    });
    const q = (await db.quotes.toArray())[0];
    expect(q.effectiveFrom).toBe(shiftDate(localDate(), 1));
    await saveQuote({ ...q, text: "温柔而坚定。" }, q.id);
    expect(await ensureDailyQuote()).toEqual(original);
    await db.quotes.delete(q.id);
    expect(await ensureDailyQuote()).toEqual(original);
  });
  it("英文必须附翻译，长度限制可拦截", () => {
    expect(() =>
      validateQuote({
        text: "Begin again.",
        translation: "",
        source: "",
        language: "en",
      }),
    ).toThrow();
    expect(() =>
      validateQuote({
        text: "字".repeat(81),
        translation: "",
        source: "",
        language: "zh",
      }),
    ).toThrow();
    expect(() =>
      validateQuote({
        text: "给自己耐心。",
        translation: "",
        source: "",
        language: "zh",
      }),
    ).not.toThrow();
  });
  it("个人句子次日起进入轮换池", () => {
    const q = {
      id: "q",
      text: "我的句子",
      translation: "",
      source: "",
      language: "zh" as const,
      effectiveFrom: "2026-10-18",
      updatedAt: new Date().toISOString(),
    };
    expect(pickQuote("2026-10-17", [q])).toEqual(pickQuote("2026-10-17", []));
    expect(
      Array.from(
        { length: 61 },
        (_, i) => pickQuote(shiftDate("2026-10-18", i), [q]).text,
      ),
    ).toContain("我的句子");
  });
  it("v3备份包含个人句子与当天快照，旧v2导入不删句子", async () => {
    await saveQuote({
      text: "今天值得被记录。",
      translation: "",
      source: "我",
      language: "zh",
    });
    const daily = await ensureDailyQuote();
    const b = await exportBackup();
    delete b.integrity;
    expect(b.version).toBe(4);
    await db.quotes.clear();
    await db.dailyQuotes.clear();
    await importBackup(b);
    expect(await db.quotes.count()).toBe(1);
    expect(await db.dailyQuotes.get(localDate())).toEqual(daily);
    const { quotes, dailyQuotes, ...v2 } = b;
    await importBackup({ ...v2, version: 2 });
    expect(await db.quotes.count()).toBe(1);
  });
  it("坏句子备份不破坏旧体重", async () => {
    await saveWeight("2026-10-17", 65);
    const b = await exportBackup();
    delete b.integrity;
    b.weights[0].weightKg = 70;
    await expect(
      importBackup({
        ...b,
        quotes: [
          {
            id: "x",
            text: "",
            translation: "",
            source: "",
            language: "en",
            effectiveFrom: "2026-10-18",
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    ).rejects.toThrow();
    expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(65);
  });
  it("v2到v3升级保留训练和旧表", async () => {
    const name = "upgrade4-" + Math.random(),
      old = new Dexie(name);
    old.version(2).stores({
      weights: "date",
      water: "date",
      sleep: "wakeDate",
      photos: "id,date",
      profile: "id",
      training: "date",
    });
    await old.table("training").put({
      date: "2026-10-17",
      status: "rest",
      aerobic: "",
      anaerobic: "",
      updatedAt: new Date().toISOString(),
    });
    old.close();
    const next = new FormDatabase(name);
    try {
      expect((await next.training.get("2026-10-17"))?.status).toBe("rest");
      expect(await next.quotes.count()).toBe(0);
      expect(await next.dailyQuotes.count()).toBe(0);
    } finally {
      await next.delete();
    }
  });
});
