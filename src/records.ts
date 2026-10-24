import {
  db,
  type WeightEntry,
  type WaterEntry,
  type SleepEntry,
  type TrainingEntry,
} from "./data";
export function localDate(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
export function dateKey(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw Error("请选择有效日期");
  const d = new Date(value + "T12:00:00");
  if (!Number.isFinite(+d) || localDate(d) !== value) throw Error("日期无效");
  return value;
}
export function shiftDate(date: string, days: number) {
  const d = new Date(dateKey(date) + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function numberIn(
  value: unknown,
  min: number,
  max: number,
  label: string,
): number {
  if (value === "" || value === null || value === undefined)
    throw Error("请填写" + label);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error(label + "应在 " + min + "–" + max + " 之间");
  return n;
}
export function sleepHours(s: Pick<SleepEntry, "startAt" | "endAt">) {
  return (+new Date(s.endAt) - +new Date(s.startAt)) / 3600000;
}
export function makeSleep(startAt: string, endAt: string): SleepEntry {
  const start = new Date(startAt),
    end = new Date(endAt);
  if (!Number.isFinite(+start) || !Number.isFinite(+end))
    throw Error("请填写完整的入睡和起床时间");
  const hours = (+end - +start) / 3600000;
  if (hours <= 0 || hours > 48)
    throw Error("起床需晚于入睡，时长不超过 48 小时");
  return {
    wakeDate: localDate(end),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
export function makeSleepForDay(
  wakeDate: string,
  startTime: string,
  endTime: string,
): SleepEntry {
  dateKey(wakeDate);
  const valid = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if (!valid(startTime) || !valid(endTime)) throw Error("请选择入睡和起床时分");
  if (startTime === endTime) throw Error("入睡与起床不能相同，请检查时间");
  const startDay = startTime > endTime ? shiftDate(wakeDate, -1) : wakeDate;
  const start = new Date(startDay + "T" + startTime),
    end = new Date(wakeDate + "T" + endTime);
  const clock = (d: Date) =>
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0");
  if (clock(start) !== startTime || clock(end) !== endTime)
    throw Error("该时分在当地夏令时转换中不存在，请调整时间");
  const result = makeSleep(start.toISOString(), end.toISOString());
  if (result.wakeDate !== wakeDate) throw Error("起床日期无效");
  return result;
}
export async function saveSleepForDay(day: string, start: string, end: string) {
  const record = makeSleepForDay(day, start, end);
  await db.sleep.put(record);
  return record;
}
export function trainingRecord(
  date: string,
  status: unknown,
  aerobic: unknown,
  anaerobic: unknown,
  updatedAt = new Date().toISOString(),
): TrainingEntry {
  if (status !== "trained" && status !== "rest")
    throw Error("请选择训练或休息");
  if (typeof aerobic !== "string" || typeof anaerobic !== "string")
    throw Error("训练内容无效");
  const a = aerobic.trim(),
    n = anaerobic.trim();
  if (a.length > 500 || n.length > 500) throw Error("每类训练最多 500 字");
  if (status === "trained" && !a && !n)
    throw Error("请至少记录一种实际完成的有氧或无氧训练");
  return {
    date: dateKey(date),
    status,
    aerobic: status === "rest" ? "" : a,
    anaerobic: status === "rest" ? "" : n,
    updatedAt,
  };
}
export async function saveTraining(
  day: string,
  status: "trained" | "rest",
  a: string,
  n: string,
) {
  await db.training.put(trainingRecord(day, status, a, n));
}
export async function saveWeight(date: string, value: unknown) {
  await db.weights.put({
    date: dateKey(date),
    weightKg: numberIn(value, 20, 500, "体重（kg）"),
    updatedAt: new Date().toISOString(),
  });
}
export async function saveWater(date: string, values: unknown[]) {
  if (values.length !== 3) throw Error("请提供早上、中午、晚上三个时段");
  const [morningMl, noonMl, eveningMl] = values.map((v) =>
    numberIn(v, 0, 10000, "饮水量（ml）"),
  );
  await db.water.put({ date: dateKey(date), morningMl, noonMl, eveningMl });
}
export async function saveSleep(start: string, end: string) {
  const record = makeSleep(start, end);
  await db.sleep.put(record);
  return record;
}
export async function saveHeight(value: unknown) {
  const heightCm = numberIn(value, 50, 260, "身高（cm）");
  await db.transaction("rw", db.profile, async () => {
    await db.profile.put({
      ...(await db.profile.get("local")),
      id: "local",
      heightCm,
    });
  });
}
export async function snapshot() {
  return db.transaction("r", db.tables, async () => ({
    weights: await db.weights.toArray(),
    water: await db.water.toArray(),
    sleep: await db.sleep.toArray(),
    training: await db.training.toArray(),
    quotes: await db.quotes.toArray(),
    dailyQuotes: await db.dailyQuotes.toArray(),
    photos: await db.photos.orderBy("date").reverse().toArray(),
    profile: await db.profile.get("local"),
  }));
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
export const emptyData: Snapshot = {
  weights: [],
  water: [],
  sleep: [],
  training: [],
  quotes: [],
  dailyQuotes: [],
  photos: [],
  profile: undefined,
};
export function waterTotal(w: WaterEntry) {
  return w.morningMl + w.noonMl + w.eveningMl;
}
export function calculateBmi(weightKg: number, heightCm?: number) {
  return heightCm && heightCm >= 50 && heightCm <= 260
    ? Number((weightKg / (heightCm / 100) ** 2).toFixed(1))
    : null;
}
export function trendRows(
  kind: string,
  data: Snapshot,
  days: number,
  today = localDate(),
) {
  const from = days === 0 ? "0000-01-01" : shiftDate(today, -days + 1);
  const rows =
    kind === "体重"
      ? data.weights.map((w: WeightEntry) => ({
          date: w.date,
          value: w.weightKg,
          bmi: calculateBmi(w.weightKg, data.profile?.heightCm),
        }))
      : kind === "大睡"
        ? data.sleep.map((s) => ({
            date: s.wakeDate,
            value: Number(sleepHours(s).toFixed(2)),
            bmi: null,
          }))
        : data.water.map((w) => ({
            date: w.date,
            value: waterTotal(w),
            bmi: null,
          }));
  return rows
    .filter((r) => r.date >= from && r.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function monthCells(month: string) {
  const first = dateKey(month + "-01");
  const offset = (new Date(first + "T12:00:00").getDay() + 6) % 7;
  const next = new Date(first + "T12:00:00");
  next.setMonth(next.getMonth() + 1);
  next.setDate(0);
  const count = next.getDate();
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, i) => ({
      date: shiftDate(first, i - offset),
      inMonth: i >= offset && i < offset + count,
    }),
  );
}
