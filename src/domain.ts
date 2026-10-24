import { validateMeasurement } from "./body-measurements";
export type WeightUnit = "kg" | "斤";
export type ExerciseKind = "有氧" | "无氧" | "综合";
export interface WeightPlan {
  id: string;
  startDate: string;
  startKg: number;
  targetKg: number;
  targetDate: string;
}
export interface ExerciseDefinition {
  id: string;
  name: string;
  category: string;
  kind: ExerciseKind;
  place: "室内" | "室外" | "均可";
  equipment: boolean;
  parameters: string[];
  custom?: boolean;
}
export interface WorkoutItem {
  id: string;
  exerciseId: string;
  name: string;
  category: string;
  kind: ExerciseKind;
  minutes: number;
  speedKmh?: number;
  inclinePercent?: number;
  distanceKm?: number;
  loadKg?: number;
  sets?: number;
  reps?: number;
  swimStyle?: string;
  note?: string;
}
export const toDisplay = (kg: number, unit: WeightUnit) =>
  kg * (unit === "斤" ? 2 : 1);
export const toKg = (value: number, unit: WeightUnit) =>
  value / (unit === "斤" ? 2 : 1);
export const displayWeight = (kg: number, unit: WeightUnit) =>
  Number(toDisplay(kg, unit).toFixed(2));
export function validDay(v: unknown) {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v + "T12:00:00")) ||
    new Date(v + "T12:00:00").getDate() !== Number(v.slice(8))
  )
    throw Error("日期无效");
  return v;
}
const object = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("数据结构无效");
  return v as Record<string, unknown>;
};
const text = (v: unknown, max = 80) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("名称或文本无效");
  return v.trim();
};
const num = (v: unknown, min: number, max: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error("数值超出有效范围");
  return v;
};
export function validatePlan(v: unknown): WeightPlan {
  const r = object(v),
    startDate = validDay(r.startDate),
    targetDate = validDay(r.targetDate);
  if (targetDate <= startDate) throw Error("目标日期需晚于开始日期");
  return {
    id: text(r.id),
    startDate,
    targetDate,
    startKg: num(r.startKg, 20, 500),
    targetKg: num(r.targetKg, 20, 500),
  };
}
export function validateExercise(v: unknown): ExerciseDefinition {
  const r = object(v);
  if (
    !["有氧", "无氧", "综合"].includes(String(r.kind)) ||
    !["室内", "室外", "均可"].includes(String(r.place)) ||
    !Array.isArray(r.parameters) ||
    r.parameters.length > 10 ||
    !r.parameters.every((p) =>
      [
        "speedKmh",
        "inclinePercent",
        "distanceKm",
        "loadKg",
        "sets",
        "reps",
        "swimStyle",
      ].includes(String(p)),
    )
  )
    throw Error("运动定义无效");
  return {
    id: text(r.id),
    name: text(r.name),
    category: text(r.category),
    kind: r.kind as ExerciseKind,
    place: r.place as ExerciseDefinition["place"],
    equipment: !!r.equipment,
    parameters: r.parameters as string[],
    custom: !!r.custom,
  };
}
export function validateWorkout(v: unknown): WorkoutItem {
  const r = object(v);
  if (!["有氧", "无氧", "综合"].includes(String(r.kind)))
    throw Error("运动类型无效");
  const result: WorkoutItem = {
    id: text(r.id),
    exerciseId: text(r.exerciseId),
    name: text(r.name),
    category: text(r.category),
    kind: r.kind as ExerciseKind,
    minutes: num(r.minutes, 0.1, 1440),
  };
  for (const [key, max] of Object.entries({
    speedKmh: 100,
    inclinePercent: 100,
    distanceKm: 2000,
    loadKg: 1000,
    sets: 1000,
    reps: 10000,
  }))
    if (r[key] !== undefined) {
      const value = num(r[key], 0, max);
      if ((key === "sets" || key === "reps") && !Number.isInteger(value))
        throw Error("组数与次数需为整数");
      (result as unknown as Record<string, unknown>)[key] = value;
    }
  if (r.swimStyle !== undefined) result.swimStyle = text(r.swimStyle, 30);
  if (r.note !== undefined) {
    if (typeof r.note !== "string" || r.note.length > 300)
      throw Error("备注最多300字");
    result.note = r.note.trim();
  }
  return result;
}
export function profileExtras(v: unknown) {
  const r = object(v),
    out: Record<string, unknown> = {};
  for (const key of ["chestCm", "waistCm", "hipCm"] as const) {
    if (r[key] !== undefined)
      out[key] = r[key] === null ? null : validateMeasurement(key, r[key]);
  }
  if (r.weightUnit !== undefined) {
    if (r.weightUnit !== "kg" && r.weightUnit !== "斤")
      throw Error("体重单位无效");
    out.weightUnit = r.weightUnit;
  }
  if (r.style !== undefined) {
    out.style = r.style === "lean" ? "lean" : "default";
  }
  if (r.weightPlan !== undefined)
    out.weightPlan = r.weightPlan === null ? null : validatePlan(r.weightPlan);
  if (r.widgets !== undefined) {
    if (
      !Array.isArray(r.widgets) ||
      !r.widgets.length ||
      r.widgets.length > 2 ||
      new Set(r.widgets).size !== r.widgets.length ||
      !r.widgets.every((x) => x === "quote" || x === "weight")
    )
      throw Error("卡片配置无效");
    out.widgets = r.widgets;
  }
  if (r.customExercises !== undefined) {
    if (!Array.isArray(r.customExercises) || r.customExercises.length > 500)
      throw Error("自定义运动过多");
    out.customExercises = r.customExercises.map(validateExercise);
    if (
      new Set((out.customExercises as ExerciseDefinition[]).map((x) => x.id))
        .size !== r.customExercises.length
    )
      throw Error("自定义运动重复");
  }
  if (r.favoriteExercises !== undefined) {
    if (
      !Array.isArray(r.favoriteExercises) ||
      r.favoriteExercises.length > 500 ||
      !r.favoriteExercises.every((x) => typeof x === "string" && x.length < 100)
    )
      throw Error("常用运动无效");
    out.favoriteExercises = [...new Set(r.favoriteExercises)];
  }
  return out;
}
