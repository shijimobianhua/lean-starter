import { useViewState } from "./view-state";
import { WorkoutStats } from "./WorkoutStats";
import { useWeightUnit } from "./units";
import { displayWeight } from "./domain";
import { Modal } from "./Modal";
import { useMuscle } from "./Onboarding";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  Moon,
  Dumbbell,
  Scale,
} from "lucide-react";
import {
  monthCells,
  localDate,
  waterTotal,
  sleepHours,
  type Snapshot,
} from "./records";
import type { RecordKind } from "./RecordEditor";
const kinds = [
  { name: "大水", icon: Droplets },
  { name: "大睡", icon: Moon },
  { name: "薄肌", icon: Dumbbell },
  { name: "体重", icon: Scale },
] as const;
export function CalendarPage({
  data,
  open,
}: {
  data: Snapshot;
  open: (kind: RecordKind, date: string) => void;
}) {
  const muscle = useMuscle(),
    unit = useWeightUnit();
  const [month, setMonth] = useViewState("calendar.month", () =>
      localDate().slice(0, 7),
    ),
    [selected, setSelected] = useViewState("calendar.selected", localDate);
  const [picking, setPicking] = useState(false),
    [draftDate, setDraftDate] = useState(selected);
  const cells = monthCells(month);
  const get = (date: string) => ({
    water: data.water.find((r) => r.date === date),
    sleep: data.sleep.find((r) => r.wakeDate === date),
    training: data.training.find((r) => r.date === date),
    weight: data.weights.find((r) => r.date === date),
  });
  const move = (delta: number) => {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + delta);
    setMonth(localDate(d).slice(0, 7));
  };
  const record = get(selected),
    photos = data.photos.filter((p) => p.date === selected);
  return (
    <>
      {picking && (
        <Modal title="选择年月日" onClose={() => setPicking(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draftDate) return;
              setSelected(draftDate);
              setMonth(draftDate.slice(0, 7));
              setPicking(false);
            }}
          >
            <label>
              跳转日期
              <input
                type="date"
                required
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </label>
            <button className="primary">确认日期</button>
          </form>
        </Modal>
      )}
      <section className="panel calendar-panel">
        <div className="calendar-heading">
          <button
            className="small-button"
            aria-label="上个月"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h2>
            <button
              className="calendar-date-button"
              aria-label="选择年月日"
              onClick={() => {
                setDraftDate(selected);
                setPicking(true);
              }}
            >
              {month.slice(0, 4)}年 {Number(month.slice(5))}月
            </button>
          </h2>
          <button
            className="small-button"
            aria-label="下个月"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="text-button"
            onClick={() => {
              setMonth(localDate().slice(0, 7));
              setSelected(localDate());
            }}
          >
            今天
          </button>
        </div>
        <div className="calendar-legend">
          <span>大水</span>
          <span>睡 · 大睡</span>
          <span>练 / 休 · {muscle}</span>
        </div>
        <div className="calendar-week" aria-hidden="true">
          {["一", "二", "三", "四", "五", "六", "日"].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className="calendar-grid" aria-label="记录日历">
          {cells.map((cell) => {
            const r = get(cell.date);
            const labels = [
              r.water ? "大水已记录" : "",
              r.sleep ? "大睡已记录" : "",
              r.training
                ? r.training.status === "rest"
                  ? "休息已确认"
                  : "训练已记录"
                : "",
              r.weight ? "体重已记录" : "",
            ].filter(Boolean);
            return (
              <button
                key={cell.date}
                aria-label={cell.date + " " + (labels.join("，") || "暂无记录")}
                aria-pressed={selected === cell.date}
                className={
                  "calendar-day " +
                  (!cell.inMonth ? "other-month " : "") +
                  (cell.date === localDate() ? "is-today" : "")
                }
                onClick={() => {
                  setSelected(cell.date);
                  if (!cell.inMonth) setMonth(cell.date.slice(0, 7));
                }}
              >
                <time dateTime={cell.date}>{Number(cell.date.slice(8))}</time>
                <span className="day-marks" aria-hidden="true">
                  {r.water && <i>水</i>}
                  {r.sleep && <i>睡</i>}
                  {r.training && (
                    <i>{r.training.status === "rest" ? "休" : "练"}</i>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel day-detail" aria-label="所选日期详情">
        <div className="section-heading">
          <h2>{selected} 的日常</h2>
          <span>{photos.length} 张照片</span>
        </div>
        {kinds.map(({ name, icon: Icon }) => {
          const value =
            name === "大水"
              ? record.water
                ? waterTotal(record.water) +
                  " ml / " +
                  (waterTotal(record.water) / 1500).toFixed(2) +
                  " 大水"
                : "未记录"
              : name === "大睡"
                ? record.sleep
                  ? sleepHours(record.sleep).toFixed(1) + " 小时"
                  : "未记录"
                : name === "体重"
                  ? record.weight
                    ? displayWeight(record.weight.weightKg, unit) + " " + unit
                    : "未记录"
                  : record.training
                    ? record.training.status === "rest"
                      ? "今日休息"
                      : record.training.items?.length
                        ? record.training.items
                            .map((x) => x.name + " " + x.minutes + "分钟")
                            .join("；")
                        : [
                            record.training.aerobic &&
                              "有氧：" + record.training.aerobic,
                            record.training.anaerobic &&
                              "无氧：" + record.training.anaerobic,
                          ]
                            .filter(Boolean)
                            .join("；")
                    : "训练待记录";
          return (
            <button
              key={name === "薄肌" ? muscle : name}
              className="day-record"
              onClick={() => open(name, selected)}
            >
              <Icon size={20} />
              <span>
                <strong>{name === "薄肌" ? muscle : name}</strong>
                <small>{value}</small>
              </span>
              <span className="edit-hint">记录 / 修改</span>
            </button>
          );
        })}
      </section>
      <WorkoutStats data={data} selected={selected} month={month} />
    </>
  );
}
