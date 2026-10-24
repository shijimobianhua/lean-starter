import { it, expect, beforeEach } from "vitest";
import { db } from "./data";
import { exportBackup, importBackup, validateBackup } from "./backup";
import { exerciseCatalog, saveWorkouts, workoutMinutes } from "./catalog";
import {
  toDisplay,
  toKg,
  validatePlan,
  validateWorkout,
  profileExtras,
} from "./domain";
import { trainingStreak } from "./Achievement";
import { futureProviders } from "./future-providers";
import { updateProfile } from "./units";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
const item = {
  id: "one",
  exerciseId: "treadmill",
  name: "跑步机爬坡",
  category: "有氧器械",
  kind: "有氧" as const,
  minutes: 40,
  speedKmh: 5,
  inclinePercent: 8,
};
it("斤与kg往返不改体重物理量", () => {
  expect(toDisplay(72.35, "斤")).toBe(144.7);
  expect(toKg(144.7, "斤")).toBe(72.35);
});
it("方案允许减重增重维持但拒绝无效日期和数值", () => {
  for (const n of [60, 75, 90])
    expect(
      validatePlan({
        id: "p",
        startDate: "2026-10-18",
        targetDate: "2027-01-01",
        startKg: 75,
        targetKg: n,
      }).targetKg,
    ).toBe(n);
  expect(() =>
    validatePlan({
      id: "p",
      startDate: "2026-02-30",
      targetDate: "2027-01-01",
      startKg: 75,
      targetKg: 60,
    }),
  ).toThrow();
});
it("运动库覆盖室内外器械徒手并有唯一id", () => {
  expect(exerciseCatalog.length).toBeGreaterThan(60);
  expect(new Set(exerciseCatalog.map((x) => x.id)).size).toBe(
    exerciseCatalog.length,
  );
  for (const n of ["跑步机爬坡", "杠铃深蹲", "俯卧撑", "游泳"])
    expect(exerciseCatalog.some((x) => x.name === n)).toBe(true);
});
it("训练参数拒绝负时长非整数组次", () => {
  expect(validateWorkout(item)).toEqual(item);
  expect(() => validateWorkout({ ...item, minutes: -2 })).toThrow();
  expect(() => validateWorkout({ ...item, sets: 1.5 })).toThrow();
});
it("结构化训练与原文字并存且每天只计一次", async () => {
  await saveWorkouts(
    "2026-10-18",
    "trained",
    [item, { ...item, id: "two", minutes: 15 }],
    { aerobic: "旧跑步", anaerobic: "旧深蹲" },
  );
  const row = (await db.training.get("2026-10-18"))!;
  expect(workoutMinutes(row)).toBe(55);
  expect(row.aerobic).toBe("旧跑步");
  expect(trainingStreak([row], "2026-10-18").current).toBe(1);
});
it("休息日不残留训练时长", async () => {
  await saveWorkouts("2026-10-18", "rest", [item], {
    aerobic: "旧",
    anaerobic: "",
  });
  const row = await db.training.get("2026-10-18");
  expect(row?.items).toEqual([]);
  expect(workoutMinutes(row)).toBe(0);
});
it("总训练时长越界拒绝写入", async () => {
  await expect(
    saveWorkouts(
      "2026-10-18",
      "trained",
      [
        { ...item, minutes: 1000 },
        { ...item, id: "two", minutes: 1000 },
      ],
      { aerobic: "", anaerobic: "" },
    ),
  ).rejects.toThrow();
  expect(await db.training.count()).toBe(0);
});
it("新版完整备份恢复方案、设置、运动项目且规范kg", async () => {
  await db.profile.put({
    id: "local",
    gender: "female",
    onboardingDone: true,
    heightCm: 175,
    weightUnit: "斤",
    widgets: ["weight", "quote"],
    weightPlan: {
      id: "p",
      startDate: "2026-10-18",
      targetDate: "2027-01-18",
      startKg: 75,
      targetKg: 65,
    },
    style: "default",
    customExercises: [
      {
        id: "custom1",
        name: "我的运动",
        category: "自定义",
        kind: "综合",
        place: "均可",
        equipment: false,
        parameters: [],
        custom: true,
      },
    ],
    favoriteExercises: ["custom1"],
  });
  await saveWorkouts("2026-10-18", "trained", [item], {
    aerobic: "",
    anaerobic: "",
  });
  const b = await exportBackup();
  expect(b.version).toBe(4);
  await Promise.all(db.tables.map((t) => t.clear()));
  await importBackup(b);
  expect((await db.profile.get("local"))?.weightPlan?.startKg).toBe(75);
  expect((await db.profile.get("local"))?.widgets).toEqual(["weight", "quote"]);
  expect((await db.training.get("2026-10-18"))?.items?.[0]).toEqual(item);
});
it("无效新增字段在事务前拒绝不会部分导入", async () => {
  await db.weights.put({
    date: "2026-10-18",
    weightKg: 75,
    updatedAt: new Date().toISOString(),
  });
  const b = await exportBackup();
  delete b.integrity;
  const invalid = { ...b, profile: { id: "local", weightUnit: "磅" } };
  await expect(importBackup(invalid)).rejects.toThrow();
  expect((await db.weights.get("2026-10-18"))?.weightKg).toBe(75);
  expect(() =>
    validateBackup({
      ...b,
      training: [
        {
          date: "2026-10-17",
          status: "trained",
          aerobic: "",
          anaerobic: "",
          updatedAt: new Date().toISOString(),
          items: [{ ...item, minutes: -3 }],
        },
      ],
    }),
  ).toThrow();
});
it("设置更新合并旧用户资料并容错未知风格", async () => {
  await db.profile.put({
    id: "local",
    gender: "female",
    hiddenQuotes: ["builtin-0"],
  });
  await updateProfile({ weightUnit: "斤" });
  expect((await db.profile.get("local"))?.hiddenQuotes).toEqual(["builtin-0"]);
  expect(profileExtras({ style: "unknown" }).style).toBe("default");
  expect(profileExtras({ style: "lean" }).style).toBe("lean");
  expect(() => profileExtras({ widgets: [] })).toThrow();
});
it("未来权威数据与AI没有默认启用或产品请求", () => {
  expect(futureProviders).toEqual({});
});
