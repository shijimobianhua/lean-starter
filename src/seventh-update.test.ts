import { beforeEach, it, expect, vi } from "vitest";
import { db } from "./data";
import {
  emptyData,
  snapshot,
  saveWeight,
  saveWater,
  saveSleep,
} from "./records";
import { createCheckpoint, listCheckpoints, recoveryDb } from "./recovery";
import {
  exportBackup,
  importBackup,
  serializeSnapshot,
  verifyBackup,
} from "./backup";
import { trendDomain, bmiDomain, weightDomain } from "./chart-scale";
import { motion, reducedMotion } from "./viewport";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
it("BMI轴与体重轴比例一致；大睡大水小幅变化不铺满纵轴", () => {
  const weights = [73, 74, 73.5],
    w = weightDomain(weights),
    b = bmiDomain(weights, 175),
    d = 1.75 ** 2;
  expect(b[0]).toBeCloseTo(w[0] / d);
  expect(b[1]).toBeCloseTo(w[1] / d);
  const sleep = trendDomain("大睡", [7.9, 8.1]),
    water = trendDomain("大水", [1450, 1550]);
  expect(0.2 / (sleep[1] - sleep[0])).toBeLessThan(0.05);
  expect(100 / water[1]).toBeLessThan(0.05);
  expect(trendDomain("大睡", [32])[1]).toBeGreaterThan(32);
});
it("系统减少动画偏好可识别，标准时序保持统一", () => {
  vi.mocked(matchMedia).mockReturnValueOnce({
    matches: true,
  } as MediaQueryList);
  expect(reducedMotion()).toBe(true);
  expect(motion.close).toBe(550);
  expect(motion.enter).toBe(800);
});
it("签名备份被改动时拒绝导入且主数据不变", async () => {
  await saveWeight("2026-10-17", 75);
  const b = await exportBackup();
  expect(b.integrity?.value).toMatch(/^[a-f0-9]{64}$/);
  expect((await verifyBackup(b)).weights[0].weightKg).toBe(75);
  b.weights[0].weightKg = 72;
  await expect(importBackup(b)).rejects.toThrow("完整性");
  expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(75);
});
it("恢复副本去重、只保留三份变化且空记录不会覆盖最后历史", async () => {
  await saveWeight("2026-10-17", 75);
  await createCheckpoint("before");
  await createCheckpoint("same");
  expect(await recoveryDb.checkpoints.count()).toBe(1);
  for (const n of [74, 73, 72]) {
    await new Promise((r) => setTimeout(r, 2));
    await saveWeight("2026-10-17", n);
    await createCheckpoint("change");
  }
  const rows = await listCheckpoints();
  expect(rows).toHaveLength(3);
  expect(rows[0].data.weights[0].weightKg).toBe(72);
  await createCheckpoint("empty", {
    ...emptyData,
    profile: { id: "local", onboardingDone: true },
  });
  expect((await listCheckpoints())[0].count).toBe(1);
});
it("主库为空后可从独立副本恢复所有记录和照片字节", async () => {
  await saveWeight("2026-10-17", 75);
  await saveWater("2026-10-17", [400, 700, 400]);
  await saveSleep("2026-10-16T23:30", "2026-10-17T07:30");
  await db.profile.put({
    id: "local",
    heightCm: 175,
    gender: "female",
    onboardingDone: true,
  });
  await db.photos.put({
    id: "p",
    date: "2026-10-17",
    createdAt: "2026-10-17T10:00:00.000Z",
    image: new Blob([new Uint8Array([255, 216, 255, 217])], {
      type: "image/jpeg",
    }),
  });
  const original = await serializeSnapshot(await snapshot());
  await createCheckpoint("safe");
  await Promise.all(db.tables.map((t) => t.clear()));
  const row = (await listCheckpoints())[0];
  await importBackup(await serializeSnapshot(row.data));
  const restored = await exportBackup();
  expect(restored.photos).toEqual(original.photos);
  expect(restored.profile).toEqual(original.profile);
  expect(restored.water).toEqual(original.water);
  expect(restored.sleep).toEqual(original.sleep);
});
it("恢复副本建立失败时导入不触及原库", async () => {
  await saveWeight("2026-10-17", 75);
  const b = await exportBackup();
  delete b.integrity;
  b.weights[0].weightKg = 72;
  const spy = vi
    .spyOn(recoveryDb.checkpoints, "put")
    .mockRejectedValueOnce(Error("空间不足"));
  await expect(importBackup(b)).rejects.toThrow("空间不足");
  spy.mockRestore();
  expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(75);
});
