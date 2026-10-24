import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Droplets,
  Moon,
  Scale,
  Camera,
  Dumbbell,
} from "lucide-react";
import { BodyContour, MuscleFlow } from "./LeanArt";
import { HomeStack, WeightProgress } from "./WeightPlan";
import { displayWeight } from "./domain";
import { type Snapshot, sleepHours, waterTotal } from "./records";
import type { RecordKind } from "./RecordEditor";

export function LeanHeader({ page, today }: { page: string; today: string }) {
  const title =
    page === "今天" ? (
      <>
        今天，
        <br />
        练出自己的线条。
      </>
    ) : page === "我的" ? (
      "我的身体档案"
    ) : page === "趋势" ? (
      "身体的变化"
    ) : (
      "把日常，连成轨迹。"
    );
  return (
    <header className={"lean-page-header " + (page === "今天" ? "home" : "")}>
      <div className="lean-wordmark">
        Lean <span>薄肌之旅</span>
      </div>
      <BodyContour
        className="lean-header-art"
        variant={page === "趋势" ? "shoulder" : "torso"}
      />
      {page === "今天" && (
        <time dateTime={today}>
          {new Date(today + "T12:00:00").toLocaleDateString("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </time>
      )}
      <h1>{title}</h1>
      <span className="lean-title-rule" aria-hidden="true" />
      <p>
        {page === "我的"
          ? "更了解自己，才能走得更远。"
          : page === "趋势"
            ? "让记录留下变化。"
            : page === "日历"
              ? "每一天，都有自己的节奏。"
              : "更轻盈的自己，一直在路上。"}
      </p>
    </header>
  );
}
export function LeanHome({
  data,
  today,
  open,
  onPhotos,
}: {
  data: Snapshot;
  today: string;
  open: (kind: RecordKind) => void;
  onPhotos: () => void;
}) {
  const water = data.water.find((r) => r.date === today),
    sleep = data.sleep.find((r) => r.wakeDate === today),
    weight = data.weights.find((r) => r.date === today),
    training = data.training.find((r) => r.date === today);
  const previousTraining = useRef(training?.updatedAt);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (previousTraining.current === training?.updatedAt) return;
    previousTraining.current = training?.updatedAt;
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 450);
    return () => clearTimeout(timer);
  }, [training?.updatedAt]);
  const unit = data.profile?.weightUnit ?? "kg";
  const recent = data.weights
    .filter((r) => r.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  const points = recent
    .map((r, i) => {
      const low = Math.min(...recent.map((r) => r.weightKg)),
        high = Math.max(...recent.map((r) => r.weightKg));
      return `${8 + (i * 124) / Math.max(1, recent.length - 1)},${38 - ((r.weightKg - low) * 28) / Math.max(0.1, high - low)}`;
    })
    .join(" ");
  return (
    <div className="lean-home">
      <HomeStack data={data} today={today} lean />
      <button
        className="lean-training"
        data-saved={saved}
        aria-label={
          data.profile?.gender === "female" ? "记录马甲线" : "记录薄肌"
        }
        onClick={() => open("薄肌")}
      >
        <MuscleFlow className="lean-training-flow" />
        <span className="lean-kicker">
          <Dumbbell size={18} /> 今日训练
        </span>
        <strong>
          {training
            ? training.status === "rest"
              ? "今天，好好休息。"
              : "今天，已经练过。"
            : "从一次训练开始。"}
        </strong>
        <span className="lean-training-detail">
          {training?.status === "trained"
            ? training.items?.length
              ? training.items
                  .map((x) => `${x.name} · ${x.minutes}分钟`)
                  .join(" / ")
              : [
                  training.aerobic && `有氧：${training.aerobic}`,
                  training.anaerobic && `无氧：${training.anaerobic}`,
                ]
                  .filter(Boolean)
                  .join(" / ")
            : training
              ? "恢复，也是训练的一部分。"
              : "有氧 / 无氧，记下实际练了什么"}
        </span>
        <span className="lean-training-action">
          {training ? "查看 / 修改" : "记录训练"}
          <ArrowUpRight size={20} />
        </span>
      </button>
      {!data.profile?.weightPlan && (
        <div className="lean-plan-empty">
          <WeightProgress data={data} />
        </div>
      )}
      <section className="lean-life-grid" aria-label="生活记录">
        <button
          className="lean-life"
          aria-label="记录大水"
          onClick={() => open("大水")}
        >
          <Droplets />
          <span>大水</span>
          {water && (
            <strong>
              {(waterTotal(water) / 1500).toFixed(2)}
              <small>大水</small>
            </strong>
          )}
          <p>{water ? `${waterTotal(water)} ml` : "1 大水 = 1500ml"}</p>
          <ArrowUpRight className="lean-entry-arrow" size={17} />
        </button>
        <button
          className="lean-life"
          aria-label="记录大睡"
          onClick={() => open("大睡")}
        >
          <Moon />
          <span>大睡</span>
          {sleep && (
            <strong>
              {sleepHours(sleep).toFixed(1)}
              <small>小时</small>
            </strong>
          )}
          <p>{sleep ? "按起床日归档" : "记下入睡和起床时间"}</p>
          <ArrowUpRight className="lean-entry-arrow" size={17} />
        </button>
        <button
          className="lean-life lean-weight"
          aria-label="记录体重"
          onClick={() => open("体重")}
        >
          <Scale />
          <span>体重</span>
          {weight && (
            <strong>
              {displayWeight(weight.weightKg, unit)}
              <small>{unit}</small>
            </strong>
          )}
          {recent.length > 1 && (
            <svg
              viewBox="0 0 140 48"
              className="lean-sparkline"
              role="img"
              aria-label="最近体重走势"
            >
              <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              {recent.map((r, i) => (
                <circle
                  key={r.date}
                  cx={Number(points.split(" ")[i].split(",")[0])}
                  cy={Number(points.split(" ")[i].split(",")[1])}
                  r="2.5"
                  fill="currentColor"
                />
              ))}
            </svg>
          )}
          <p>{weight ? "每日一条 · 点击修改" : "按自己的节奏记录"}</p>
          <ArrowUpRight className="lean-entry-arrow" size={17} />
        </button>
      </section>
      <button className="lean-photo-entry" onClick={onPhotos}>
        <Camera />
        <span>
          <strong>身体变化</strong>
          <small>把变化，交给时间。 · {data.photos.length} 张</small>
        </span>
        <ArrowUpRight size={20} />
      </button>
    </div>
  );
}
