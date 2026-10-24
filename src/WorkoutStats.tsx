import { useViewState } from "./view-state";
import { Disclosure } from "./FoldSection";
import { useState } from "react";
import { localDate, shiftDate, type Snapshot } from "./records";
import { workoutMinutes } from "./catalog";
export function WorkoutStats({
  data,
  selected,
  month,
}: {
  data: Snapshot;
  selected: string;
  month: string;
}) {
  const [mode, setMode] = useViewState("calendar.stats.period", "月");
  const weekday = (new Date(selected + "T12:00:00").getDay() + 6) % 7,
    start = mode === "月" ? month + "-01" : shiftDate(selected, -weekday);
  const end =
      mode === "月"
        ? localDate(
            new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12),
          )
        : shiftDate(start, 6),
    days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  const records = data.training.filter(
      (x) => x.date >= start && x.date <= end && x.status === "trained",
    ),
    items = records.flatMap((x) => x.items ?? []),
    total = items.reduce((s, x) => s + x.minutes, 0),
    untimed = records.filter(
      (x) => (x.aerobic || x.anaerobic) && !x.items?.length,
    ).length;
  const distribution = [
      ...items.reduce(
        (m, x) => m.set(x.name, (m.get(x.name) ?? 0) + x.minutes),
        new Map<string, number>(),
      ),
    ].sort((a, b) => b[1] - a[1]),
    max = Math.max(1, ...distribution.map((x) => x[1])),
    daily = Array.from({ length: days }, (_, i) => {
      const date = shiftDate(start, i);
      return {
        date,
        minutes: workoutMinutes(records.find((x) => x.date === date)),
      };
    }),
    peak = Math.max(30, ...daily.map((x) => x.minutes));
  return (
    <section className="workout-stats">
      <div className="section-heading">
        <h2>运动统计</h2>
        <div className="segments">
          {["周", "月"].map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        {start} — {end} · {records.length} 天训练 · {Number(total.toFixed(1))}{" "}
        分钟
      </p>
      <section className="panel">
        <h3>运动分布</h3>
        {distribution.length ? (
          distribution.map(([name, n]) => (
            <div className="distribution-row" key={name}>
              <div>
                <span>{name}</span>
                <small>{Number(n.toFixed(1))} 分钟</small>
              </div>
              <div className="bar-track">
                <span style={{ width: (n / max) * 100 + "%" }} />
              </div>
            </div>
          ))
        ) : (
          <p className="hint">填写训练时长后显示统计</p>
        )}
        <div className="type-totals">
          {["有氧", "无氧", "综合"].map((k) => (
            <small key={k}>
              {k}{" "}
              {Number(
                items
                  .filter((x) => x.kind === k)
                  .reduce((s, x) => s + x.minutes, 0)
                  .toFixed(1),
              )}{" "}
              分钟
            </small>
          ))}
        </div>
        {untimed > 0 && (
          <p className="hint">{untimed} 天文字记录未填时长，未计入时长统计</p>
        )}
      </section>
      <section className="panel">
        <h3>运动时长趋势</h3>
        <div className="duration-bars" role="img" aria-label="每日训练分钟数">
          {daily.map((d) => (
            <div key={d.date}>
              <span
                title={d.date + " " + d.minutes + "分钟"}
                style={{ height: (d.minutes / peak) * 140 + "px" }}
              />
              <small>
                {Number(d.date.slice(8)) % 5 === 0 || d.date === start
                  ? Number(d.date.slice(8))
                  : ""}
              </small>
            </div>
          ))}
        </div>
        <p className="hint">
          纵向为时长（分钟），最高 {Math.ceil(peak)} · 横向为日期
        </p>
        <Disclosure memoryKey="calendar.stats.details">
          <summary>查看每日时长</summary>
          {daily
            .filter((x) => x.minutes > 0)
            .map((x) => (
              <p key={x.date}>
                {x.date} · {Number(x.minutes.toFixed(1))} 分钟
              </p>
            ))}
        </Disclosure>
      </section>
    </section>
  );
}
