import GraphemeSplitter from "grapheme-splitter";
import { type Snapshot, localDate, sleepHours, waterTotal } from "./records";
import { displayWeight } from "./domain";
import { hasActualTraining, trainingStreak } from "./training-streak";
import { PRODUCT_URL } from "./share-config";

export const contents = {
  enrollment: "入学卡",
  today: "今日记录",
  progress: "学位进度",
  graduation: "毕业纪念",
} as const;
export const templates = {
  "minimal-degree": "极简学位",
  "absurd-note": "抽象自嘲",
  "warm-archive": "暖灰档案",
  "lean-lines": "薄肌线条",
} as const;
export const phrases = [
  "今天先到场，认真记一笔",
  "一点点记录，也算认真生活",
  "身体的事，慢慢来",
] as const;
export type ContentKind = keyof typeof contents;
export type TemplateId = keyof typeof templates;
export type MetricKey = "water" | "sleep" | "training" | "weight";
export const metricLabels: Record<MetricKey, string> = {
  water: "饮水",
  sleep: "睡眠",
  training: "训练",
  weight: "体重",
};
export interface ShareOptions {
  kind: ContentKind;
  template: TemplateId;
  showNickname: boolean;
  nickname: string;
  phrase: number;
  phraseMode?: "preset" | "custom";
  customPhrase?: string;
  selected: Record<MetricKey, boolean>;
  exact: Record<"water" | "sleep" | "weight", boolean>;
}
export const defaultOptions: ShareOptions = {
  kind: "enrollment",
  template: "minimal-degree",
  showNickname: false,
  nickname: "",
  phrase: 0,
  phraseMode: "preset",
  customPhrase: "",
  selected: { water: true, sleep: true, training: true, weight: false },
  exact: { water: false, sleep: false, weight: false },
};
export function visibleCharacters(value: string): string[] {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale: string,
        options: { granularity: string },
      ) => { segment: (s: string) => Iterable<{ segment: string }> };
    }
  ).Segmenter;
  return Segmenter
    ? Array.from(
        new Segmenter("zh", { granularity: "grapheme" }).segment(value),
        (v) => v.segment,
      )
    : new GraphemeSplitter().splitGraphemes(value);
}
export function clipVisible(value: string, max: number) {
  return visibleCharacters(value).slice(0, max).join("");
}
export function clipNickname(value: string) {
  return clipVisible(
    value
      .replace(/[\r\n\t\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
      .trim(),
    12,
  );
}
export function normalizePhrase(value: string) {
  return clipVisible(
    value
      .replace(
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim(),
    30,
  );
}
export function todayMetrics(data: Snapshot, day: string) {
  const water = data.water.find((r) => r.date === day),
    sleep = data.sleep.find((r) => r.wakeDate === day),
    training = data.training.find((r) => r.date === day),
    weight = data.weights.find((r) => r.date === day);
  return {
    water: water
      ? { status: "已记录", value: `${waterTotal(water)} ml` }
      : undefined,
    sleep:
      sleep && Number.isFinite(sleepHours(sleep)) && sleepHours(sleep) > 0
        ? { status: "已记录", value: `${sleepHours(sleep).toFixed(1)} 小时` }
        : undefined,
    training:
      training?.status === "rest"
        ? { status: "今日休息" }
        : training && hasActualTraining(training)
          ? { status: "已训练" }
          : undefined,
    weight: weight
      ? {
          status: "已记录",
          value: `${displayWeight(weight.weightKg, data.profile?.weightUnit ?? "kg")} ${data.profile?.weightUnit ?? "kg"}`,
        }
      : undefined,
  };
}
export interface ShareCardSnapshot {
  kind: ContentKind;
  template: TemplateId;
  date: string;
  generatedAt: string;
  nickname?: string;
  muscle: string;
  phrase: string;
  metrics: { key: MetricKey; label: string; text: string }[];
  streak?: { current: number; best: number; passed: boolean };
  rule: "training-100-v1";
  productUrl: string;
}
// Only explicitly visible values cross this boundary; renderer never receives raw records.
export function createShareSnapshot(
  data: Snapshot,
  options: ShareOptions,
  day = localDate(),
  now = new Date(),
): ShareCardSnapshot {
  const streak = trainingStreak(data.training, day),
    available = todayMetrics(data, day);
  if (options.kind === "graduation" && !streak.passed)
    throw Error("历史最长未达100天，暂不能生成毕业纪念卡。");
  if (options.kind === "today" && !Object.values(available).some(Boolean))
    throw Error("今天还没有有效记录，请先记录。");
  const metrics: ShareCardSnapshot["metrics"] = [];
  if (options.kind === "today") {
    for (const key of Object.keys(metricLabels) as MetricKey[]) {
      const item = available[key];
      if (!options.selected[key] || !item) continue;
      metrics.push({
        key,
        label: metricLabels[key],
        text:
          key !== "training" && options.exact[key] && "value" in item
            ? item.value
            : item.status,
      });
    }
    if (!metrics.length) throw Error("请至少选择一项已有记录。");
  }
  return {
    kind: options.kind,
    template: options.template,
    date: day,
    generatedAt: now.toISOString(),
    ...(options.showNickname
      ? { nickname: clipNickname(options.nickname) || "LEAN学员" }
      : {}),
    muscle: data.profile?.gender === "female" ? "马甲线" : "薄肌",
    phrase:
      (options.phraseMode === "custom"
        ? normalizePhrase(options.customPhrase ?? "")
        : "") ||
      phrases[options.phrase] ||
      phrases[0],
    metrics,
    ...(["progress", "graduation"].includes(options.kind) ? { streak } : {}),
    rule: "training-100-v1",
    productUrl: PRODUCT_URL,
  };
}
