import { beforeEach, describe, it, expect, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { db } from "./data";
import { saveWeight, saveWater, saveSleep, saveHeight } from "./records";
import { exportBackup, importBackup } from "./backup";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
describe("备份与恢复", () => {
  it("全部记录和照片字节往返一致", async () => {
    await saveWeight("2026-10-17", 65);
    await saveWater("2026-10-17", [400, 700, 400]);
    await saveSleep("2026-10-16T23:30", "2026-10-17T07:30");
    await saveHeight(175);
    await db.photos.put({
      id: "photo1",
      date: "2026-10-17",
      createdAt: new Date().toISOString(),
      image: new NodeBlob([new Uint8Array([255, 216, 255, 217])], {
        type: "image/jpeg",
      }) as unknown as Blob,
    });
    const backup = await exportBackup();
    delete backup.integrity;
    await Promise.all(db.tables.map((t) => t.clear()));
    await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(await db.weights.count()).toBe(1);
    expect(await db.sleep.count()).toBe(1);
    expect((await db.profile.get("local"))?.heightCm).toBe(175);
    expect(await db.photos.count()).toBe(1);
    expect(backup.photos[0].base64).toBe("/9j/2Q==");
    expect((await db.photos.get("photo1"))?.image.size).toBe(4);
  });
  it("坏数据不破坏已有记录", async () => {
    await saveWeight("2026-10-17", 65);
    const b = await exportBackup();
    delete b.integrity;
    b.weights[0].weightKg = -1;
    await expect(importBackup(b)).rejects.toThrow();
    expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(65);
  });
  it("版本不支持和重复日期被拒绝", async () => {
    await saveWeight("2026-10-17", 65);
    const b = await exportBackup();
    delete b.integrity;
    await expect(importBackup({ ...b, version: 99 })).rejects.toThrow();
    b.weights.push(b.weights[0]);
    await expect(importBackup(b)).rejects.toThrow("重复");
  });
  it("导入写入失败会回滚已写入部分", async () => {
    await saveWeight("2026-10-17", 65);
    const b = await exportBackup();
    delete b.integrity;
    b.weights[0].weightKg = 70;
    const spy = vi
      .spyOn(db.photos, "bulkPut")
      .mockRejectedValueOnce(Error("模拟空间不足"));
    await expect(importBackup(b)).rejects.toThrow();
    spy.mockRestore();
    expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(65);
  });
  it("合并保留其他日期，同日期覆盖", async () => {
    await saveWeight("2026-10-17", 65);
    const b = await exportBackup();
    delete b.integrity;
    b.weights[0].weightKg = 70;
    await saveWeight("2026-10-16", 66);
    await importBackup(b);
    expect(await db.weights.count()).toBe(2);
    expect((await db.weights.get("2026-10-17"))?.weightKg).toBe(70);
  });
  it("照片删除不影响其他记录", async () => {
    await saveWeight("2026-10-17", 65);
    await db.photos.put({
      id: "p",
      date: "2026-10-17",
      createdAt: new Date().toISOString(),
      image: new NodeBlob(["x"]) as unknown as Blob,
    });
    await db.photos.delete("p");
    expect(await db.photos.count()).toBe(0);
    expect(await db.weights.count()).toBe(1);
  });
});
