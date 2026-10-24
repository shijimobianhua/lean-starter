import { describe, it, expect } from "vitest";
import { emptyData, shiftDate, type Snapshot } from "./records";
import { trainingStreak } from "./training-streak";
import {
  createShareSnapshot,
  defaultOptions,
  clipNickname,
  todayMetrics,
  templates,
  contents,
} from "./share-model";
import type { TrainingEntry } from "./data";
const today = "2026-10-20";
const train = (date: string): TrainingEntry => ({
  date,
  status: "trained",
  aerobic: "走路",
  anaerobic: "",
  updatedAt: "",
});
const days = (n: number, end = today) =>
  Array.from({ length: n }, (_, i) => train(shiftDate(end, -i)));
const sample = (): Snapshot => ({
  ...emptyData,
  training: days(100),
  water: [{ date: today, morningMl: 0, noonMl: 0, eveningMl: 0 }],
  sleep: [
    {
      wakeDate: today,
      startAt: "2026-10-19T23:00:00+08:00",
      endAt: "2026-10-20T07:00:00+08:00",
      timeZone: "Asia/Shanghai",
    },
  ],
  weights: [{ date: today, weightKg: 72.3, updatedAt: "" }],
});
describe("share rules and privacy", () => {
  it("keeps yesterday until day end; rest and holes break current, future ignored", () => {
    expect(trainingStreak(days(12, shiftDate(today, -1)), today).current).toBe(
      12,
    );
    expect(
      trainingStreak(
        [
          ...days(12, shiftDate(today, -1)),
          { ...train(today), status: "rest" },
        ],
        today,
      ),
    ).toEqual({ current: 0, best: 12, passed: false });
    expect(
      trainingStreak(
        [train(today), train(shiftDate(today, -2)), train(shiftDate(today, 1))],
        today,
      ),
    ).toEqual({ current: 1, best: 1, passed: false });
  });
  it("counts legacy and structured entries once, ignores empty trained entries", () => {
    const item = { name: "走路", minutes: 10 } as NonNullable<
      TrainingEntry["items"]
    >[number];
    expect(
      trainingStreak(
        [
          { ...train(today), aerobic: "", items: [item] },
          train(today),
          { ...train(shiftDate(today, -1)), aerobic: " " },
        ],
        today,
      ),
    ).toEqual({ current: 1, best: 1, passed: false });
  });
  it("locks 99 days and recalculates after deleting historical training", () => {
    expect(() =>
      createShareSnapshot(
        { ...emptyData, training: days(99) },
        { ...defaultOptions, kind: "graduation" },
        today,
      ),
    ).toThrow("100天");
    const data = { ...emptyData, training: days(100, shiftDate(today, -10)) };
    const s = createShareSnapshot(
      data,
      { ...defaultOptions, kind: "graduation" },
      today,
    );
    expect(s.streak).toEqual({ current: 0, best: 100, passed: true });
    expect(() =>
      createShareSnapshot(
        { ...data, training: data.training.slice(1) },
        { ...defaultOptions, kind: "graduation" },
        today,
      ),
    ).toThrow();
  });
  it("empty enrollment has no made-up statistics; no today record means no today card", () => {
    expect(
      createShareSnapshot(emptyData, defaultOptions, today).streak,
    ).toBeUndefined();
    expect(() =>
      createShareSnapshot(
        emptyData,
        { ...defaultOptions, kind: "today" },
        today,
      ),
    ).toThrow();
    expect(
      createShareSnapshot(
        emptyData,
        { ...defaultOptions, kind: "progress" },
        today,
      ).streak?.current,
    ).toBe(0);
  });
  it("rest is a valid today record but not training; zeros and cross-midnight sleep survive", () => {
    const data = sample();
    data.training = [{ ...train(today), status: "rest" }];
    expect(todayMetrics(data, today).training?.status).toBe("今日休息");
    expect(todayMetrics(data, today).water?.value).toBe("0 ml");
    expect(todayMetrics(data, today).sleep?.value).toBe("8.0 小时");
  });
  it("keeps hidden sensitive fields out of snapshots and uses explicit weight units", () => {
    const data = sample();
    data.profile = { id: "local", weightUnit: "斤" };
    let s = createShareSnapshot(
      data,
      { ...defaultOptions, kind: "today", nickname: "私密昵称" },
      today,
    );
    expect(JSON.stringify(s)).not.toMatch(
      /72\.3|144\.6|私密昵称|weightKg|heightCm/,
    );
    expect(s.nickname).toBeUndefined();
    expect(s.metrics.map((m) => m.text)).toEqual([
      "已记录",
      "已记录",
      "已训练",
    ]);
    s = createShareSnapshot(
      data,
      {
        ...defaultOptions,
        kind: "today",
        selected: { water: false, sleep: false, training: false, weight: true },
        exact: { ...defaultOptions.exact, weight: true },
      },
      today,
    );
    expect(s.metrics).toEqual([
      { key: "weight", label: "体重", text: "144.6 斤" },
    ]);
    expect(s.productUrl).not.toMatch(/昵称|144|72|\?/);
  });
  it("does not create a blank daily card, or substitute yesterday's weight", () => {
    const data = sample();
    data.weights[0].date = shiftDate(today, -1);
    expect(todayMetrics(data, today).weight).toBeUndefined();
    expect(() =>
      createShareSnapshot(
        data,
        {
          ...defaultOptions,
          kind: "today",
          selected: {
            water: false,
            sleep: false,
            training: false,
            weight: false,
          },
        },
        today,
      ),
    ).toThrow("至少");
  });
  it("clips visible graphemes without breaking family emoji and removes bidi overrides", () => {
    const emoji = "👨‍👩‍👧‍👦";
    expect(clipNickname(emoji.repeat(13))).toBe(emoji.repeat(12));
    expect(clipNickname("e\u0301".repeat(13))).toBe("e\u0301".repeat(12));
    expect(clipNickname("甲\u202e乙\n丙")).toBe("甲乙丙");
  });
  it("all twelve combinations retain the same facts and snapshot is independent of source edits", () => {
    const data = sample();
    for (const kind of Object.keys(contents) as (keyof typeof contents)[]) {
      for (const template of Object.keys(
        templates,
      ) as (keyof typeof templates)[]) {
        const s = createShareSnapshot(
          data,
          { ...defaultOptions, kind, template },
          today,
        );
        expect(s.kind).toBe(kind);
        expect(s.rule).toBe("training-100-v1");
        if (s.streak) expect(s.streak.best).toBe(100);
      }
    }
    const frozen = createShareSnapshot(
      data,
      { ...defaultOptions, kind: "progress" },
      today,
    );
    data.training.length = 0;
    expect(frozen.streak?.best).toBe(100);
  });
});
