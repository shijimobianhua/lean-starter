export const measurementFields = [
  { key: "heightCm", label: "身高", min: 50, max: 260 },
  { key: "chestCm", label: "胸围", min: 0.1, max: 1000 },
  { key: "waistCm", label: "腰围", min: 0.1, max: 1000 },
  { key: "hipCm", label: "臀围", min: 0.1, max: 1000 },
] as const;
export type MeasurementKey = (typeof measurementFields)[number]["key"];
export function validateMeasurement(
  key: MeasurementKey,
  value: unknown,
): number {
  const field = measurementFields.find((f) => f.key === key)!;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    throw Error(`请填写有效的${field.label}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < field.min || n > field.max)
    throw Error(`${field.label}应在 ${field.min}–${field.max} cm 之间`);
  return Math.round(n * 10) / 10;
}
