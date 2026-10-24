import {
  serializeSnapshot,
  verifyBackup,
  backupDigest,
  mergeSnapshot,
  type Backup,
} from "./backup";
import { snapshot, emptyData, localDate, type Snapshot } from "./records";

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const PART_BYTES = 24 * 1024 * 1024;
// Each part is independently checked, but a split set must be complete to restore.
export async function* backupFiles(
  data?: Snapshot,
  partBytes = PART_BYTES,
): AsyncGenerator<File> {
  const d = data ?? (await snapshot());
  const core = { ...d, photos: [] };
  const base = new TextEncoder().encode(JSON.stringify(core)).length + 2048;
  const limit = Math.min(MAX_IMPORT_BYTES - 4096, partBytes);
  if (base >= limit)
    throw Error("文字记录超出单卷容量，请联系维护者协助导出；本机记录未改动");
  const groups: Snapshot["photos"][] = [[]];
  let bytes = base;
  for (const photo of d.photos) {
    const estimate = 4 * Math.ceil(photo.image.size / 3) + 1024;
    if (base + estimate > limit)
      throw Error("单张历史照片超出备份容量，请先单独保存原图");
    if (bytes + estimate > limit) {
      groups.push([]);
      bytes = base;
    }
    groups[groups.length - 1].push(photo);
    bytes += estimate;
  }
  const id = crypto.randomUUID();
  for (let i = 0; i < groups.length; i++) {
    const value = await serializeSnapshot({ ...d, photos: groups[i] });
    if (groups.length > 1) {
      value.backupSet = { id, index: i + 1, total: groups.length };
      value.integrity = {
        algorithm: "SHA-256",
        value: await backupDigest(value),
      };
    }
    const suffix = groups.length > 1 ? `-分卷-${i + 1}-共${groups.length}` : "";
    const file = new File(
      [JSON.stringify(value)],
      `薄肌-LEAN-${localDate()}${suffix}.json`,
      { type: "application/json" },
    );
    if (file.size > MAX_IMPORT_BYTES)
      throw Error("备份超出可恢复容量，导出已停止；本机记录未改动");
    yield file;
  }
}

async function collect(files: File[]) {
  if (!files.length) throw Error("请选择备份文件");
  let result: Snapshot = {
    ...emptyData,
    weights: [],
    water: [],
    sleep: [],
    training: [],
    photos: [],
    quotes: [],
    dailyQuotes: [],
  };
  let set: Backup["backupSet"];
  const indices = new Set<number>();
  let hasOnboarding = false;
  for (const file of files) {
    if (file.size > MAX_IMPORT_BYTES)
      throw Error("单个备份文件不能超过 100MB，请使用完整分卷备份");
    const value = JSON.parse(await file.text()) as Backup;
    const d = await verifyBackup(value);
    if (value.backupSet) {
      const part = value.backupSet;
      if (
        !part.id ||
        !Number.isInteger(part.total) ||
        part.total < 2 ||
        !Number.isInteger(part.index) ||
        part.index < 1 ||
        part.index > part.total
      )
        throw Error("分卷信息无效");
      if (!set) set = part;
      if (
        set.id !== part.id ||
        set.total !== part.total ||
        indices.has(part.index)
      )
        throw Error("请只选择同一套备份的全部分卷，不能混用或重复");
      indices.add(part.index);
    } else if (files.length !== 1)
      throw Error("普通备份请单独选择；分卷请一次选齐");
    for (const table of [
      "weights",
      "water",
      "sleep",
      "training",
      "photos",
      "quotes",
      "dailyQuotes",
    ] as const) {
      const merged = new Map<string, unknown>();
      for (const row of [...result[table], ...d[table]]) {
        const r = row as unknown as Record<string, string>;
        merged.set(r.id ?? r.date ?? r.wakeDate, row);
      }
      (result as unknown as Record<string, unknown>)[table] = [
        ...merged.values(),
      ];
    }
    result.profile = d.profile ?? result.profile;
    hasOnboarding ||= !!(value.profile && "onboardingDone" in value.profile);
    // Let the browser release the part's JSON string before decoding the next one.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (set && (indices.size !== set.total || files.length !== set.total))
    throw Error(
      `分卷未选齐：需要 ${set.total} 个文件，本次选择 ${files.length} 个；尚未写入记录`,
    );
  return { data: result, hasOnboarding };
}
export async function inspectBackupFiles(files: File[]) {
  const { data } = await collect(files);
  return (
    data.weights.length +
    data.water.length +
    data.sleep.length +
    data.training.length +
    data.photos.length +
    data.quotes.length
  );
}
export async function restoreBackupFiles(files: File[]) {
  const { data, hasOnboarding } = await collect(files);
  // Validate every part before a single main-database transaction writes any of them.
  return mergeSnapshot(data, hasOnboarding);
}
