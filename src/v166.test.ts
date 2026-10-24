import { beforeEach, expect, it } from "vitest";
import { db } from "./data";
import { profileExtras } from "./domain";
import { snapshot } from "./records";
import { mergeSnapshot, exportBackup, verifyBackup } from "./backup";
import {
  normalizeStyle,
  readWelcomeDraft,
  saveWelcomeDraft,
  clearWelcomeDraft,
} from "./ui-style";
import { updateProfile } from "./units";
beforeEach(async () => {
  sessionStorage.clear();
  await Promise.all(db.tables.map((t) => t.clear()));
});
it("双风格设置保持原记录且未知值回退", async () => {
  await db.profile.put({
    id: "local",
    heightCm: 178,
    waistCm: 78,
    onboardingDone: true,
  });
  await db.weights.put({
    date: "2026-10-23",
    weightKg: 72,
    updatedAt: "2026-10-23T00:00:00Z",
  });
  await updateProfile({ style: "lean" });
  expect((await snapshot()).weights).toHaveLength(1);
  expect((await db.profile.get("local"))?.waistCm).toBe(78);
  expect(profileExtras({ style: "lean" }).style).toBe("lean");
  expect(profileExtras({ style: "other" }).style).toBe("default");
  expect(normalizeStyle(undefined)).toBe("default");
});
it("引导草稿保留选择与步骤，非法草稿容错且可清除", () => {
  saveWelcomeDraft({ step: 1, style: "lean", gender: "female" });
  expect(readWelcomeDraft()).toEqual({
    step: 1,
    style: "lean",
    gender: "female",
  });
  sessionStorage.setItem("form-welcome-v166", '{"step":50}');
  expect(readWelcomeDraft().step).toBe(-1);
  clearWelcomeDraft();
  expect(readWelcomeDraft().style).toBe("default");
});
it("旧备份未携带风格时合并保留当前偏好和敏感资料", async () => {
  await db.profile.put({
    id: "local",
    style: "lean",
    waistCm: 78,
    onboardingDone: true,
  });
  await mergeSnapshot(
    { ...(await snapshot()), profile: { id: "local", heightCm: 176 } },
    false,
  );
  const p = await db.profile.get("local");
  expect(p?.style).toBe("lean");
  expect(p?.waistCm).toBe(78);
  expect(p?.onboardingDone).toBe(true);
});

it("含薄肌风格的完整备份通过验证并保留身体资料", async () => {
  await db.profile.put({
    id: "local",
    style: "lean",
    heightCm: 178,
    chestCm: 96,
    waistCm: 78,
    hipCm: 94,
    onboardingDone: true,
  });
  const d = await verifyBackup(await exportBackup());
  expect(d.profile?.style).toBe("lean");
  expect(d.profile?.waistCm).toBe(78);
});
import { resetLocalData } from "./ResetPanel";
it("清空本机数据同时清理风格启动缓存与未完成引导", async () => {
  await db.profile.put({ id: "local", style: "lean", onboardingDone: true });
  localStorage.setItem("form-style", "lean");
  saveWelcomeDraft({ step: 1, gender: "male", style: "lean" });
  await resetLocalData();
  expect(await db.profile.count()).toBe(0);
  expect(localStorage.getItem("form-style")).toBeNull();
  expect(readWelcomeDraft().step).toBe(-1);
});
