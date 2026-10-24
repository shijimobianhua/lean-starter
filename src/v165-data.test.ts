import { beforeEach, it, expect } from "vitest";
import { db } from "./data";
import { emptyData, snapshot } from "./records";
import { updateProfile } from "./units";
import { exportBackup, importBackup, verifyBackup } from "./backup";
import { backupFiles, restoreBackupFiles } from "./backup-files";
import { hasData, createCheckpoint, recoveryDb } from "./recovery";
import { validateMeasurement } from "./body-measurements";
import {
  clipVisible,
  visibleCharacters,
  createShareSnapshot,
  defaultOptions,
} from "./share-model";
import { phraseLines } from "./share-layout";
import { File as NodeFile } from "node:buffer";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await recoveryDb.checkpoints.clear();
});
it("三围可选保存、完整备份恢复并保留显式清空", async () => {
  await updateProfile({ heightCm: 172, chestCm: 91.2, waistCm: 76, hipCm: 94 });
  const backup = await exportBackup();
  await db.profile.clear();
  await importBackup(JSON.parse(JSON.stringify(backup)));
  expect(await db.profile.get("local")).toMatchObject({
    heightCm: 172,
    chestCm: 91.2,
    waistCm: 76,
    hipCm: 94,
  });
  await updateProfile({ waistCm: null });
  const cleared = await exportBackup();
  await updateProfile({ waistCm: 90 });
  await importBackup(cleared);
  expect((await db.profile.get("local"))?.waistCm).toBeNull();
});
it("旧备份缺三围仍可导入且合并不会抹掉现有新字段", async () => {
  await updateProfile({ heightCm: 170 });
  const legacy = await exportBackup();
  await updateProfile({ chestCm: 92, waistCm: 77 });
  await importBackup(legacy);
  expect(await db.profile.get("local")).toMatchObject({
    heightCm: 170,
    chestCm: 92,
    waistCm: 77,
  });
});
it("分卷与恢复副本保留三围，只有三围的资料也属于有效数据", async () => {
  await updateProfile({ hipCm: 93.5 });
  const data = await snapshot();
  expect(hasData(data)).toBe(true);
  const checkpoint = await createCheckpoint("资料测试", data);
  expect(checkpoint?.data.profile?.hipCm).toBe(93.5);
  const original = globalThis.File;
  globalThis.File = NodeFile as unknown as typeof File;
  try {
    const files = [];
    for await (const f of backupFiles(data)) files.push(f);
    await db.profile.clear();
    await restoreBackupFiles(files);
  } finally {
    globalThis.File = original;
  }
  expect((await db.profile.get("local"))?.hipCm).toBe(93.5);
});
it("无效三围在备份写入前被拒绝，原记录不被覆盖", async () => {
  await updateProfile({ waistCm: 79 });
  const bad = await exportBackup();
  delete bad.integrity;
  bad.profile!.waistCm = -2;
  await expect(importBackup(bad)).rejects.toThrow("腰围");
  expect((await db.profile.get("local"))?.waistCm).toBe(79);
  for (const n of [NaN, Infinity, 0, -1])
    expect(() => validateMeasurement("chestCm", n)).toThrow();
});
it("30个可见字符不截断家庭Emoji，自定义空白回退预设且不暴露三围", () => {
  const value = "👨‍👩‍👧‍👦".repeat(31);
  expect(visibleCharacters(clipVisible(value, 30))).toHaveLength(30);
  const data = {
    ...emptyData,
    profile: { id: "local", chestCm: 92, waistCm: 76, hipCm: 96 },
  };
  const s = createShareSnapshot(
    data,
    { ...defaultOptions, phraseMode: "custom", customPhrase: value },
    "2026-10-20",
  );
  expect(visibleCharacters(s.phrase)).toHaveLength(30);
  expect(JSON.stringify(s)).not.toMatch(/chestCm|waistCm|hipCm/);
  const fallback = createShareSnapshot(
    data,
    { ...defaultOptions, phraseMode: "custom", customPhrase: " \n " },
    "2026-10-20",
  );
  expect(fallback.phrase.length).toBeGreaterThan(0);
});
it("自定义文案按测量宽度换行，不丢字，不留下单个尾字", () => {
  const chinese =
    "每天认真记录一点点变化三十个字也要清楚舒适地呈现在卡片里".slice(0, 30);
  const measure = (s: string) => visibleCharacters(s).length * 32;
  const lines = phraseLines(chinese, measure, 710);
  expect(lines.join("")).toBe(chinese);
  expect(lines.length).toBeLessThanOrEqual(3);
  expect(lines.every((l) => measure(l) <= 710)).toBe(true);
  expect(
    phraseLines("ABCDEFGHIJKLMNOABCDEFGHIJKLMNO", measure, 710).join(""),
  ).toBe("ABCDEFGHIJKLMNOABCDEFGHIJKLMNO");
});
