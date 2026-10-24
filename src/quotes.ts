import { db, type Quote, type QuoteContent, type DailyQuote } from "./data";
import { dateKey, localDate, shiftDate } from "./records";
import { builtinQuotes } from "./builtin-quotes";
export { builtinQuotes } from "./builtin-quotes";
export const normalizeQuoteText = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/[\s\u00A0]+/g, " ")
    .trim();
export function validateQuote(value: unknown): QuoteContent {
  if (!value || typeof value !== "object") throw Error("句子格式无效");
  const v = value as Record<string, unknown>;
  if (v.language !== "zh" && v.language !== "en")
    throw Error("请选择中文或英文");
  const max = v.language === "en" ? 160 : 80;
  if (
    typeof v.text !== "string" ||
    !v.text.trim() ||
    v.text.trim().length > max
  )
    throw Error(
      "主句需填写，" +
        (v.language === "en" ? "英文最多160" : "中文最多80") +
        "字",
    );
  if (typeof v.translation !== "string" || v.translation.trim().length > 80)
    throw Error("翻译最多80字");
  if (v.language === "en" && !v.translation.trim())
    throw Error("英文句子请填写中文翻译");
  if (typeof v.source !== "string" || v.source.trim().length > 60)
    throw Error("出处最多60字");
  return {
    text: normalizeQuoteText(v.text),
    translation: normalizeQuoteText(v.translation),
    source: normalizeQuoteText(v.source),
    language: v.language,
  };
}
export function pickQuote(
  date: string,
  custom: Quote[],
  hidden: string[] = [],
): QuoteContent {
  dateKey(date);
  const pool = [
    ...builtinQuotes.filter(
      (_, i) =>
        !hidden.includes("builtin-" + i) &&
        !custom.some((q) => q.id === "builtin-" + i && q.effectiveFrom <= date),
    ),
    ...custom
      .filter((q) => q.effectiveFrom <= date)
      .sort((a, b) => a.id.localeCompare(b.id)),
  ];
  if (!pool.length)
    return {
      text: "",
      translation: "",
      source: "",
      language: "zh",
    };
  const [y, m, d] = date.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return pool[((day % pool.length) + pool.length) % pool.length];
}
export async function ensureDailyQuote(
  date = localDate(),
): Promise<DailyQuote | undefined> {
  dateKey(date);
  return db.transaction(
    "rw",
    db.quotes,
    db.dailyQuotes,
    db.profile,
    async () => {
      const existing = await db.dailyQuotes.get(date);
      if (existing) return existing;
      const selected = {
        date,
        ...pickQuote(
          date,
          await db.quotes.toArray(),
          (await db.profile.get("local"))?.hiddenQuotes,
        ),
      };
      if(!selected.text)return undefined;
      await db.dailyQuotes.put(selected);
      return selected;
    },
  );
}
export async function saveQuote(content: unknown, id?: string) {
  const value = validateQuote(content);
  await db.quotes.put({
    id: id ?? crypto.randomUUID(),
    ...value,
    effectiveFrom: shiftDate(localDate(), 1),
    updatedAt: new Date().toISOString(),
  });
}

export async function removeQuote(id: string) {
  await db.transaction("rw", db.quotes, db.profile, async () => {
    await db.quotes.delete(id);
    if (id.startsWith("builtin-")) {
      const p = await db.profile.get("local");
      await db.profile.put({
        ...p,
        id: "local",
        hiddenQuotes: [...new Set([...(p?.hiddenQuotes ?? []), id])],
      });
    }
  });
}
export async function restoreBuiltinQuotes() {
  await db.transaction("rw", db.quotes, db.profile, async () => {
    const p = await db.profile.get("local");
    await db.profile.put({ ...p, id: "local", hiddenQuotes: [] });
    await db.quotes.bulkDelete(
      (await db.quotes.toArray())
        .filter((q) => q.id.startsWith("builtin-"))
        .map((q) => q.id),
    );
  });
}
