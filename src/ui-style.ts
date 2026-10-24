export type UiStyle = "default" | "lean";
export const normalizeStyle = (value: unknown): UiStyle =>
  value === "lean" ? "lean" : "default";
export interface WelcomeDraft {
  step: number;
  gender?: "male" | "female";
  style: UiStyle;
}
const key = "form-welcome-v166";
export function readWelcomeDraft(): WelcomeDraft {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      value &&
      Number.isInteger(value.step) &&
      value.step >= -1 &&
      value.step <= 2
    )
      return {
        step: value.step,
        style: normalizeStyle(value.style),
        gender:
          value.gender === "male" || value.gender === "female"
            ? value.gender
            : undefined,
      };
  } catch {}
  return { step: -1, style: "default" };
}
export function saveWelcomeDraft(value: WelcomeDraft) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function clearWelcomeDraft() {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
