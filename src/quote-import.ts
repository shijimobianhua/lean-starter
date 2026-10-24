import {listCheckpoints,setSetting} from "./recovery";
import { db, type QuoteContent } from "./data";
import { builtinQuotes, normalizeQuoteText, validateQuote } from "./quotes";
import { localDate, shiftDate } from "./records";
export interface ImportRow {
  value: QuoteContent;
  error: string;
  duplicate: boolean;
}
export function parseQuotes(
  text: string,
  existing: QuoteContent[] = [],
): ImportRow[] {
  const seen = new Set(existing.map((q) => normalizeQuoteText(q.text)));
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((line) => {
      const [raw = "", translation = "", source = ""] =
        line.split(/\t|\s*\|\s*/);
      const value: QuoteContent = {
        text: normalizeQuoteText(raw),
        translation: normalizeQuoteText(translation),
        source: normalizeQuoteText(source),
        language: /[\u3400-\u9fff]/.test(raw) ? "zh" : "en",
      };
      let error = "";
      try {
        validateQuote(value);
      } catch (e) {
        error = (e as Error).message;
      }
      const duplicate = seen.has(value.text);
      seen.add(value.text);
      return { value, error, duplicate };
    });
}
export async function importQuotes(values: QuoteContent[]) {
  const checked = values.map(validateQuote);
  if (checked.length > 500) throw Error("一次最多导入500句");
  await db.transaction("rw", db.quotes, async () => {
    const seen = new Set((await db.quotes.toArray()).map((q) => q.text));
    for (const value of checked) {
      if (seen.has(value.text)) continue;
      seen.add(value.text);
      await db.quotes.put({
        ...value,
        id: crypto.randomUUID(),
        effectiveFrom: shiftDate(localDate(), 1),
        updatedAt: new Date().toISOString(),
      });
    }
  });
}
export async function clearQuotes() {
  const latest=(await listCheckpoints())[0];if(latest)await setSetting("ignored-recovery",latest.id);
  await db.transaction(
    "rw",
    [db.quotes, db.profile, db.dailyQuotes],
    async () => {
      const p = await db.profile.get("local");
      await db.profile.put({
        ...p,
        id: "local",
        hiddenQuotes: builtinQuotes.map((_, i) => "builtin-" + i),
      });
      await db.quotes.clear();
      await db.dailyQuotes.clear();
    },
  );
}
