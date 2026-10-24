import { profileExtras, validateWorkout } from "./domain";
import { createCheckpoint } from "./recovery";
import {
  db,
  type PhotoEntry,
  type WeightEntry,
  type WaterEntry,
  type SleepEntry,
  type TrainingEntry,
  type Quote,
  type DailyQuote,
  type Profile,
} from "./data";
import {
  snapshot,
  dateKey,
  numberIn,
  makeSleep,
  trainingRecord,
  type Snapshot,
} from "./records";
import { photoTypes } from "./photo-utils";
import { validateQuote } from "./quotes";
interface BackupPhoto {
  id: string;
  date: string;
  type: string;
  base64: string;
  createdAt: string;
}
export interface Backup {
  backupSet?: { id: string; index: number; total: number };
  app: "FORM DAILY";
  version: 4;
  integrity?: { algorithm: "SHA-256"; value: string };
  exportedAt: string;
  weights: WeightEntry[];
  water: WaterEntry[];
  sleep: SleepEntry[];
  training: TrainingEntry[];
  quotes: Quote[];
  dailyQuotes: DailyQuote[];
  photos: BackupPhoto[];
  profile?: Profile;
}
function encode(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
function decode(base64: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0)
    throw Error("照片编码无效");
  const s = atob(base64);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
export async function exportBackup(): Promise<Backup> {
  return serializeSnapshot(await snapshot());
}
export async function serializeSnapshot(d: Snapshot): Promise<Backup> {
  const backup: Backup = {
    app: "FORM DAILY",
    version: 4,
    exportedAt: new Date().toISOString(),
    weights: d.weights,
    water: d.water,
    sleep: d.sleep,
    profile: d.profile,
    training: d.training,
    quotes: d.quotes,
    dailyQuotes: d.dailyQuotes,
    photos: [],
  };
  // Encode one photo at a time; never allocate all decoded photo buffers together.
  for (const p of d.photos) {
    backup.photos.push({
      id: p.id,
      date: p.date,
      type: p.image.type,
      base64: encode(new Uint8Array(await p.image.arrayBuffer())),
      createdAt: p.createdAt,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  backup.integrity = {
    algorithm: "SHA-256",
    value: await backupDigest(backup),
  };
  return backup;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  return value;
}
export async function backupDigest(value: unknown) {
  if (!crypto.subtle)
    throw Error("当前环境不支持备份校验，请使用HTTPS或本机地址");
  const { integrity, ...payload } = value as Record<string, unknown>;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical(payload))),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function verifyBackup(value: unknown): Promise<Snapshot> {
  const raw = obj(value);
  if (raw.integrity !== undefined) {
    const integrity = obj(raw.integrity);
    if (
      integrity.algorithm !== "SHA-256" ||
      typeof integrity.value !== "string" ||
      !/^[a-f0-9]{64}$/.test(integrity.value) ||
      (await backupDigest(value)) !== integrity.value
    )
      throw Error("备份完整性校验失败，文件可能损坏或被修改");
  }
  return validateBackup(value);
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("备份结构无效");
  return v as Record<string, unknown>;
}
function arr(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > 100000)
    throw Error("备份记录列表无效或过大");
  return v.map(obj);
}
function text(v: unknown) {
  if (typeof v !== "string" || !v || v.length > 200)
    throw Error("备份文本字段无效");
  return v;
}
function iso(v: unknown) {
  const s = text(v);
  if (!Number.isFinite(+new Date(s))) throw Error("时间字段无效");
  return s;
}
function unique(rows: Record<string, unknown>[], key: string) {
  const keys = rows.map((r) => text(r[key]));
  if (new Set(keys).size !== keys.length) throw Error("备份包含重复记录");
}
export function validateBackup(value: unknown) {
  const b = obj(value);
  if (
    b.app !== "FORM DAILY" ||
    (b.version !== 1 && b.version !== 2 && b.version !== 3 && b.version !== 4)
  )
    throw Error("不支持的备份格式或版本");
  const weights = arr(b.weights);
  unique(weights, "date");
  const w = weights.map((r) => ({
    date: dateKey(r.date),
    weightKg: numberIn(r.weightKg, 20, 500, "体重"),
    updatedAt: iso(r.updatedAt),
  }));
  const water = arr(b.water);
  unique(water, "date");
  const a = water.map((r) => ({
    date: dateKey(r.date),
    morningMl: numberIn(r.morningMl, 0, 10000, "早间饮水"),
    noonMl: numberIn(r.noonMl, 0, 10000, "中间饮水"),
    eveningMl: numberIn(r.eveningMl, 0, 10000, "晚间饮水"),
  }));
  const sleeps = arr(b.sleep);
  unique(sleeps, "wakeDate");
  const s = sleeps.map((r) => {
    const startAt = iso(r.startAt),
      endAt = iso(r.endAt);
    makeSleep(startAt, endAt);
    const timeZone = text(r.timeZone);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(endAt));
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    const wakeDate = part("year") + "-" + part("month") + "-" + part("day");
    if (wakeDate !== dateKey(r.wakeDate)) throw Error("大睡起床日与时区不一致");
    return { wakeDate, startAt, endAt, timeZone };
  });
  const training = b.version === 1 ? [] : arr(b.training);
  unique(training, "date");
  const t = training.map((r) => {
    const items =
      r.items === undefined
        ? undefined
        : (() => {
            if (!Array.isArray(r.items) || r.items.length > 100)
              throw Error("训练列表无效");
            const rows = r.items.map(validateWorkout);
            if (
              new Set(rows.map((x) => x.id)).size !== rows.length ||
              rows.reduce((s, x) => s + x.minutes, 0) > 1440
            )
              throw Error("训练列表重复或时长无效");
            if (r.status === "rest" && rows.length)
              throw Error("休息日不能包含训练");
            return rows;
          })();
    const row = trainingRecord(
      dateKey(r.date),
      r.status,
      r.status === "trained" && items?.length && !r.aerobic && !r.anaerobic
        ? "结构化训练"
        : r.aerobic,
      r.anaerobic,
      iso(r.updatedAt),
    );
    if (items !== undefined) {
      row.items = items;
      row.aerobic = typeof r.aerobic === "string" ? r.aerobic : "";
    }
    return row;
  });
  const quotes = b.version === 3 || b.version === 4 ? arr(b.quotes) : [];
  unique(quotes, "id");
  const q: Quote[] = quotes.map((r) => ({
    id: text(r.id),
    ...validateQuote(r),
    effectiveFrom: dateKey(r.effectiveFrom),
    updatedAt: iso(r.updatedAt),
  }));
  const dailyQuotes =
    b.version === 3 || b.version === 4 ? arr(b.dailyQuotes) : [];
  unique(dailyQuotes, "date");
  const dq: DailyQuote[] = dailyQuotes.map((r) => ({
    date: dateKey(r.date),
    ...validateQuote(r),
  }));
  const photos = arr(b.photos);
  unique(photos, "id");
  const p: PhotoEntry[] = photos.map((r) => {
    const type = text(r.type);
    if (!photoTypes.includes(type)) throw Error("照片类型不支持");
    if (typeof r.base64 !== "string" || r.base64.length > 22 * 1024 * 1024)
      throw Error("照片内容过大");
    const bytes = decode(r.base64);
    if (!bytes.length) throw Error("照片为空");
    const jpeg = bytes[0] === 255 && bytes[1] === 216;
    const png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!(type === "image/jpeg" ? jpeg : type === "image/png" ? png : webp))
      throw Error("照片内容与类型不匹配");
    return {
      id: text(r.id),
      date: dateKey(r.date),
      createdAt: iso(r.createdAt),
      image: new Blob([bytes], { type }),
    };
  });
  const profile = b.profile === undefined ? undefined : obj(b.profile);
  return {
    weights: w,
    water: a,
    sleep: s,
    photos: p,
    training: t,
    quotes: q,
    dailyQuotes: dq,
    profile: profile
      ? {
          ...profileExtras(profile),
          id: "local",
          gender:
            profile.gender === "male" || profile.gender === "female"
              ? (profile.gender as "male" | "female")
              : undefined,
          onboardingDone: profile.onboardingDone === true,
          hiddenQuotes:
            profile.hiddenQuotes === undefined
              ? undefined
              : (() => {
                  if (
                    !Array.isArray(profile.hiddenQuotes) ||
                    profile.hiddenQuotes.length > 60 ||
                    profile.hiddenQuotes.some(
                      (x) => typeof x !== "string" || !/^builtin-\d+$/.test(x),
                    )
                  )
                    throw Error("句子设置无效");
                  return profile.hiddenQuotes as string[];
                })(),
          heightCm:
            profile.heightCm === undefined
              ? undefined
              : numberIn(profile.heightCm, 50, 260, "身高"),
        }
      : undefined,
  };
}
export async function importBackup(value: unknown) {
  const d = await verifyBackup(value);
  return mergeSnapshot(
    d,
    !!(
      obj(value).profile && "onboardingDone" in (obj(value).profile as object)
    ),
  );
}
export async function mergeSnapshot(d: Snapshot, hasOnboarding = true) {
  await createCheckpoint("导入前的恢复副本");
  await db.transaction("rw", db.tables, async () => {
    await db.weights.bulkPut(d.weights);
    await db.water.bulkPut(d.water);
    await db.sleep.bulkPut(d.sleep);
    await db.photos.bulkPut(d.photos);
    await db.training.bulkPut(d.training);
    await db.quotes.bulkPut(d.quotes);
    await db.dailyQuotes.bulkPut(d.dailyQuotes);
    if (d.profile) {
      const present = Object.fromEntries(
        Object.entries(d.profile).filter(([, v]) => v !== undefined),
      );
      if (!hasOnboarding) delete present.onboardingDone;
      await db.profile.put({
        ...(await db.profile.get("local")),
        ...present,
        id: "local",
      });
    }
  });
  return d;
}
