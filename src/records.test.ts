import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { db } from "./data";
import {
  saveWeight,
  saveWater,
  saveSleep,
  saveHeight,
  snapshot,
  waterTotal,
  makeSleep,
  trendRows,
  dateKey,
} from "./records";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("本地记录规则", () => {
  it("同一天体重覆盖，跨日保留", async () => {
    await saveWeight("2026-10-17", 65);
    await saveWeight("2026-10-17", 64.5);
    await saveWeight("2026-10-16", 66);
    expect(await db.weights.count()).toBe(2);
    expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(64.5);
  });
  it("大水合计为1500ml", async () => {
    await saveWater("2026-10-17", [400, 700, 400]);
    expect(waterTotal((await db.water.get("2026-10-17"))!)).toBe(1500);
  });
  it("跨午夜8小时按起床日归档", async () => {
    const r = await saveSleep("2026-10-16T23:30", "2026-10-17T07:30");
    expect(r.wakeDate).toBe("2026-10-17");
    expect((+new Date(r.endAt) - +new Date(r.startAt)) / 3600000).toBe(8);
  });
  it("非法记录不落库", async () => {
    await expect(saveWeight("2026-10-17", "")).rejects.toThrow();
    await expect(saveWater("2026-10-17", [-1, 700, 400])).rejects.toThrow();
    await expect(saveHeight(0)).rejects.toThrow();
    expect(() => makeSleep("2026-10-17T23:00", "2026-10-17T07:00")).toThrow();
    expect(() => dateKey("2026-02-30")).toThrow();
    expect((await snapshot()).weights).toEqual([]);
  });
  it("缺失日期不补零且范围排序正确", async () => {
    await saveWeight("2026-10-17", 65);
    await saveWeight("2026-10-15", 66);
    await saveWeight("2026-09-01", 70);
    const rows = trendRows("体重", await snapshot(), 7, "2026-10-17");
    expect(rows.map((r) => r.date)).toEqual(["2026-10-15", "2026-10-17"]);
    expect(rows.map((r) => r.value)).toEqual([66, 65]);
  });
  it("重新打开数据库仍可读取", async () => {
    await saveHeight(175);
    db.close();
    await db.open();
    expect((await snapshot()).profile?.heightCm).toBe(175);
  });
});
