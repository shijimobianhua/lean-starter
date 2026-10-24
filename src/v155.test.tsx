import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { db } from "./data";
import { emptyData, localDate, type Snapshot } from "./records";
import { WeightProgress } from "./WeightPlan";
import { TrainingEditor } from "./TrainingEditor";
import {
  backupFiles,
  inspectBackupFiles,
  restoreBackupFiles,
  MAX_IMPORT_BYTES,
} from "./backup-files";
import { readDraft, clearAllDrafts } from "./drafts";
import stableIds from "./exercise-ids.json";
import { exerciseCatalog } from "./catalog";

beforeEach(async () => {
  vi.stubGlobal("Blob", NodeBlob);
  await Promise.all(db.tables.map((t) => t.clear()));
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());
function photo(id: string, size = 6000) {
  const bytes = new Uint8Array(size);
  bytes.set([255, 216, 255, 224]);
  return {
    id,
    date: localDate(),
    createdAt: new Date().toISOString(),
    image: new NodeBlob([bytes], { type: "image/jpeg" }) as unknown as Blob,
  };
}
async function files(data: Snapshot, limit?: number) {
  vi.stubGlobal("File", NodeFile);
  const result: File[] = [];
  for await (const file of backupFiles(data, limit)) result.push(file);
  return result;
}
it.each([
  [77, "已增", "2"],
  [73, "已减", "2"],
  [75, "体重变化", "0"],
])("目标减重时真实变化 %s 的文案正确", (kg, label, value) => {
  const data = {
    ...emptyData,
    weights: [
      {
        date: localDate(),
        weightKg: Number(kg),
        updatedAt: new Date().toISOString(),
      },
    ],
    profile: {
      id: "local",
      weightPlan: {
        id: "p",
        startKg: 75,
        targetKg: 65,
        startDate: "2026-01-01",
        targetDate: "2027-01-01",
      },
    },
  };
  const { container } = render(<WeightProgress data={data} />);
  expect(
    container.querySelector(".progress-gauge small")?.textContent,
  ).toContain(label);
  expect(container.querySelector(".progress-gauge strong")?.textContent).toBe(
    value,
  );
});
it("分卷缺失、重复、损坏均不写入；完整分卷一次事务恢复照片与记录", async () => {
  const data = {
    ...emptyData,
    weights: [
      { date: localDate(), weightKg: 75, updatedAt: new Date().toISOString() },
    ],
    profile: { id: "local", onboardingDone: true },
    photos: [photo("a"), photo("b"), photo("c")],
  };
  const parts = await files(data, 15000);
  expect(parts.length).toBe(3);
  await db.weights.put({
    date: localDate(),
    weightKg: 88,
    updatedAt: new Date().toISOString(),
  });
  await expect(restoreBackupFiles(parts.slice(0, 2))).rejects.toThrow("未选齐");
  await expect(
    restoreBackupFiles([parts[0], parts[0], parts[2]]),
  ).rejects.toThrow("重复");
  const bad = JSON.parse(await parts[1].text());
  bad.weights[0].weightKg = 99;
  const damaged = new NodeFile(
    [JSON.stringify(bad)],
    "bad.json",
  ) as unknown as File;
  await expect(
    restoreBackupFiles([parts[0], damaged, parts[2]]),
  ).rejects.toThrow("完整性");
  expect((await db.weights.get(localDate()))?.weightKg).toBe(88);
  expect(await db.photos.count()).toBe(0);
  expect(await inspectBackupFiles(parts)).toBe(4);
  await restoreBackupFiles(parts.reverse());
  expect((await db.weights.get(localDate()))?.weightKg).toBe(75);
  expect(await db.photos.count()).toBe(3);
  expect((await db.photos.get("b"))?.image.size).toBe(6000);
});
it("超过100MB照片编码的数据可以分卷导出并全部通过恢复校验", async () => {
  const shared = photo("shared", 1024 * 1024);
  const parts = await files({
    ...emptyData,
    photos: Array.from({ length: 76 }, (_, i) => ({
      ...shared,
      id: "large-" + i,
    })),
  });
  expect(parts.reduce((n, f) => n + f.size, 0)).toBeGreaterThan(
    MAX_IMPORT_BYTES,
  );
  expect(parts.every((f) => f.size < MAX_IMPORT_BYTES)).toBe(true);
  expect(await inspectBackupFiles(parts)).toBe(76);
}, 60000);
it("训练草稿卸载后恢复，保存后清理且保留正式训练记录", async () => {
  const run = async (action: () => Promise<unknown>) => {
    await action();
    return true;
  };
  const props = { date: localDate(), data: emptyData, run, onClose: vi.fn() };
  const view = render(<TrainingEditor {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "今日休息" }));
  await waitFor(() =>
    expect(
      readDraft<{ status: string }>("training:" + localDate() + ":new")?.status,
    ).toBe("rest"),
  );
  view.unmount();
  render(<TrainingEditor {...props} />);
  expect(screen.getByText("已恢复上次未保存的训练草稿")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "保存薄肌" }));
  await waitFor(() =>
    expect(readDraft("training:" + localDate() + ":new")).toBeUndefined(),
  );
  expect((await db.training.get(localDate()))?.status).toBe("rest");
});
it("清空草稿不删除主题或其他存储；目录原有标识不会因排序变化", () => {
  localStorage.setItem("daily-draft:test", "{}");
  localStorage.setItem("form-theme", "dark");
  clearAllDrafts();
  expect(localStorage.getItem("form-theme")).toBe("dark");
  expect(localStorage.getItem("daily-draft:test")).toBeNull();
  expect(
    exerciseCatalog.every(
      (x) => x.id === stableIds[x.name as keyof typeof stableIds],
    ),
  ).toBe(true);
  expect(new Set(exerciseCatalog.map((x) => x.id)).size).toBe(
    exerciseCatalog.length,
  );
});
