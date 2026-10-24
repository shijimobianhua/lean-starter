import { describe, it, expect, beforeEach } from "vitest";
import Dexie from "dexie";
import { db, FormDatabase } from "./data";
import {
  calculateBmi,
  makeSleepForDay,
  sleepHours,
  saveTraining,
  saveWeight,
  saveHeight,
  snapshot,
  trendRows,
  monthCells,
  localDate,
} from "./records";
import { exportBackup, importBackup } from "./backup";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("第三次更新数据兼容", () => {
  it("v1数据库升级保留全部旧表与照片", async () => {
    const name = "migration-" + Math.random();
    const old = new Dexie(name);
    old.version(1).stores({
      weights: "date",
      water: "date",
      sleep: "wakeDate",
      photos: "id,date",
      profile: "id",
    });
    await old.table("weights").put({
      date: "2026-10-17",
      weightKg: 65,
      updatedAt: new Date().toISOString(),
    });
    await old.table("photos").put({
      id: "old",
      date: "2026-10-17",
      createdAt: new Date().toISOString(),
      image: new Blob(["x"], { type: "image/jpeg" }),
    });
    old.close();
    const next = new FormDatabase(name);
    try {
      expect((await next.weights.get("2026-10-17"))?.weightKg).toBe(65);
      expect((await next.photos.get("old"))?.image.size).toBe(1);
      expect(await next.training.count()).toBe(0);
    } finally {
      await next.delete();
    }
  });
  it("v2训练与休息备份往返，v1兼容且不清空现有训练", async () => {
    await saveTraining("2026-10-17", "trained", "跑步", "");
    await saveTraining("2026-10-16", "rest", "", "");
    const b = await exportBackup();
    delete b.integrity;
    expect(b.version).toBe(4);
    await db.training.clear();
    await importBackup(b);
    expect((await db.training.get("2026-10-17"))?.aerobic).toBe("跑步");
    expect((await db.training.get("2026-10-16"))?.status).toBe("rest");
    const { training, ...legacy } = b;
    await importBackup({ ...legacy, version: 1 });
    expect(await db.training.count()).toBe(2);
  });
  it("空训练被拒绝，有氧或无氧单独记录均可", async () => {
    await expect(
      saveTraining("2026-10-17", "trained", "", ""),
    ).rejects.toThrow();
    await saveTraining("2026-10-17", "trained", "", "深蹲");
    expect((await db.training.get("2026-10-17"))?.anaerobic).toBe("深蹲");
    await saveTraining("2026-10-17", "rest", "旧内容", "");
    expect((await db.training.get("2026-10-17"))?.aerobic).toBe("");
  });
  it("BMI按身高和每日体重计算，更新身高重算，不补空白日", async () => {
    expect(calculateBmi(64, 160)).toBe(25);
    expect(calculateBmi(64)).toBeNull();
    await saveWeight("2026-10-17", 64);
    await saveHeight(160);
    expect(trendRows("体重", await snapshot(), 7, "2026-10-17")[0].bmi).toBe(
      25,
    );
    await saveHeight(200);
    expect(trendRows("体重", await snapshot(), 7, "2026-10-17")[0].bmi).toBe(
      16,
    );
    expect(trendRows("体重", await snapshot(), 7, "2026-10-17")).toHaveLength(
      1,
    );
  });
  it("大睡跨月、同日小睡与相同时分校验", () => {
    const r = makeSleepForDay("2026-11-01", "23:30", "07:30");
    expect(localDate(new Date(r.startAt))).toBe("2026-10-31");
    expect(r.wakeDate).toBe("2026-11-01");
    expect(sleepHours(r)).toBe(8);
    expect(sleepHours(makeSleepForDay("2026-10-17", "13:00", "14:00"))).toBe(1);
    expect(() => makeSleepForDay("2026-10-17", "07:00", "07:00")).toThrow();
    expect(() => makeSleepForDay("2026-10-17", "25:00", "07:00")).toThrow();
  });
  it("日历闰年、跨年与周一对齐", () => {
    const leap = monthCells("2024-02");
    expect(leap.filter((c) => c.inMonth)).toHaveLength(29);
    expect(new Date(leap[0].date + "T12:00:00").getDay()).toBe(1);
    const jan = monthCells("2027-01");
    expect(jan.some((c) => c.date.startsWith("2026-12"))).toBe(true);
    expect(jan.length % 7).toBe(0);
  });
  it("非法训练备份不改写旧数据", async () => {
    await saveWeight("2026-10-17", 65);
    const b = await exportBackup();
    delete b.integrity;
    const broken = {
      ...b,
      weights: [{ ...b.weights[0], weightKg: 70 }],
      training: [
        {
          date: "2026-10-17",
          status: "trained",
          aerobic: "",
          anaerobic: "",
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await expect(importBackup(broken)).rejects.toThrow();
    expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(65);
  });
});
