import type { TrainingEntry } from "./data";
import { localDate, shiftDate } from "./records";

export function hasActualTraining(r: TrainingEntry) {
  return (
    r.status === "trained" &&
    !!(r.items?.length || r.aerobic.trim() || r.anaerobic.trim())
  );
}
// Extracted unchanged from 1.5.6: today may continue yesterday until the day ends.
export function trainingStreak(rows: TrainingEntry[], today = localDate()) {
  const days = new Set(
    rows
      .filter((r) => hasActualTraining(r) && r.date <= today)
      .map((r) => r.date),
  );
  let best = 0,
    n = 0,
    previous = "";
  for (const day of [...days].sort()) {
    n = previous && shiftDate(previous, 1) === day ? n + 1 : 1;
    best = Math.max(best, n);
    previous = day;
  }
  let current = 0,
    day = days.has(today) ? today : shiftDate(today, -1);
  const resting = rows.some((r) => r.date === today && r.status === "rest");
  while (!resting && days.has(day)) {
    current++;
    day = shiftDate(day, -1);
  }
  return { current, best, passed: best >= 100 };
}
