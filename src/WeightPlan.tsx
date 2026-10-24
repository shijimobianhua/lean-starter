import { useViewState } from "./view-state";
import { ProgressGauge } from "./ProgressGauge";
import { useEffect } from "react";
import { readDraft, clearDraft, useDraftProtection } from "./drafts";
import { useMemo } from "react";
import { useState, useRef, type PointerEvent } from "react";
import { Modal } from "./Modal";
import { askConfirm } from "./confirm";
import { updateProfile, useWeightUnit } from "./units";
import { displayWeight, toKg, validatePlan } from "./domain";
import { localDate, shiftDate, type Snapshot } from "./records";
import { DailyQuoteCard } from "./QuotePanel";
export function WeightPlanSettings({ data }: { data: Snapshot }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="panel settings-entry" onClick={() => setOpen(true)}>
        <span>体重管理方案</span>
        <span aria-hidden="true">›</span>
      </button>
      {open && <PlanForm data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
function PlanForm({ data, onClose }: { data: Snapshot; onClose: () => void }) {
  const globalUnit = useWeightUnit();
  const draftKey = "weight-plan:" + (data.profile?.weightPlan?.id ?? "new");
  const [saved] = useState(() =>
    readDraft<{
      unit: "kg" | "斤";
      start: string;
      end: string;
      initial: string;
      target: string;
    }>(draftKey),
  );
  const [unit, setUnit] = useState(saved?.unit ?? globalUnit);
  const old = data.profile?.weightPlan,
    latest = data.weights
      .filter((x) => x.date <= localDate())
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  const [start, setStart] = useState(
      saved?.start ?? old?.startDate ?? localDate(),
    ),
    [end, setEnd] = useState(
      saved?.end ?? old?.targetDate ?? shiftDate(localDate(), 112),
    ),
    [initial, setInitial] = useState(
      saved?.initial ??
        (old
          ? String(displayWeight(old.startKg, unit))
          : latest
            ? String(displayWeight(latest.weightKg, unit))
            : ""),
    ),
    [target, setTarget] = useState(
      saved?.target ?? (old ? String(displayWeight(old.targetKg, unit)) : ""),
    ),
    [dirty, setDirty] = useState(!!saved),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unitBusy, setUnitBusy] = useState(false),
    [finished, setFinished] = useState(false);
  const draftValue = useMemo(
    () => ({ unit, start, end, initial, target }),
    [unit, start, end, initial, target],
  );
  const draftError = useDraftProtection(
    draftKey,
    draftValue,
    dirty && !finished,
  );
  return (
    <Modal
      title="体重管理方案"
      onClose={onClose}
      closeRequested={finished}
      canClose={() =>
        !busy &&
        (!dirty ||
          askConfirm("还有未保存的方案，确定放弃？").then((ok) => {
            if (ok) {
              clearDraft(draftKey);
              setDirty(false);
            }
            return ok;
          }))
      }
    >
      {saved && (
        <p className="hint" role="status">
          已恢复上次未保存的方案草稿
        </p>
      )}
      {draftError && <p role="alert">{draftError}</p>}
      <section className="plan-unit">
        <h3>体重单位</h3>
        <div className="segments">
          {(["kg", "斤"] as const).map((u) => (
            <button
              key={u}
              aria-pressed={unit === u}
              disabled={busy || unitBusy}
              onClick={async () => {
                setUnitBusy(true);
                try {
                  await updateProfile({ weightUnit: u });
                  if (initial)
                    setInitial(
                      String(displayWeight(toKg(Number(initial), unit), u)),
                    );
                  if (target)
                    setTarget(
                      String(displayWeight(toKg(Number(target), unit), u)),
                    );
                  setUnit(u);
                } catch {
                  setError("单位保存失败，请重试");
                } finally {
                  setUnitBusy(false);
                }
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </section>
      <form
        onChange={() => setDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await updateProfile({
              weightPlan: validatePlan({
                id: old?.id ?? crypto.randomUUID(),
                startDate: start,
                targetDate: end,
                startKg: toKg(Number(initial), unit),
                targetKg: toKg(Number(target), unit),
              }),
            });
            clearDraft(draftKey);
            setDirty(false);
            setFinished(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存失败");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          初始体重（{unit}）
          <input
            type="number"
            step="0.1"
            required
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </label>
        <label>
          目标体重（{unit}）
          <input
            type="number"
            step="0.1"
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <div className="parameter-grid">
          <label>
            开始日期
            <input
              type="date"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            目标日期
            <input
              type="date"
              required
              min={shiftDate(start || localDate(), 1)}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <label>
          计划周数
          <input
            type="number"
            min="1"
            max="520"
            step="1"
            value={
              Math.max(
                1,
                Math.round((Date.parse(end) - Date.parse(start)) / 604800000),
              ) || ""
            }
            onChange={(e) => {
              if (Number(e.target.value) > 0)
                setEnd(
                  shiftDate(start, Math.min(520, Number(e.target.value)) * 7),
                );
            }}
          />
        </label>
        <p className="hint">进度依实际记录显示，目标日期不会自动标记完成</p>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy || unitBusy}>
          保存方案
        </button>
        {old && (
          <button
            type="button"
            className="text-button danger"
            disabled={busy}
            onClick={async () => {
              if (
                await askConfirm("移除体重方案？历史体重记录将保留", "移除方案")
              ) {
                setBusy(true);
                try {
                  await updateProfile({ weightPlan: null });
                  clearDraft(draftKey);
                  setDirty(false);
                  setFinished(true);
                } catch {
                  setError("方案移除失败，请重试");
                } finally {
                  setBusy(false);
                }
              }
            }}
          >
            移除方案
          </button>
        )}
      </form>
    </Modal>
  );
}
export function WeightProgress({ data }: { data: Snapshot }) {
  const unit = useWeightUnit(),
    p = data.profile?.weightPlan;
  const current = data.weights
    .filter((x) => x.date >= (p?.startDate ?? "") && x.date <= localDate())
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!p)
    return (
      <div className="weight-progress">
        <h2>体重管理方案</h2>
        <p>给下一阶段，定一个目标</p>
        <WeightPlanSettings data={data} />
      </div>
    );
  const diff = p.targetKg - p.startKg,
    change = current ? current.weightKg - p.startKg : 0,
    ratio = diff
      ? Math.max(0, Math.min(1, change / diff))
      : current && Math.abs(change) < 0.1
        ? 1
        : 0,
    days = Math.max(
      1,
      (Date.parse(p.targetDate) - Date.parse(p.startDate)) / 86400000,
    ),
    elapsed = Math.max(
      0,
      (Date.parse(localDate()) - Date.parse(p.startDate)) / 86400000,
    ),
    week = Math.min(Math.ceil(days / 7), Math.floor(elapsed / 7) + 1),
    weeks = Math.ceil(days / 7);
  return (
    <div className="weight-progress">
      <div className="section-heading">
        <h2>体重管理方案</h2>
        <small>
          第 {week}/{weeks} 周
        </small>
      </div>
      <div className="plan-summary">
        <div className="plan-value">
          <strong>{displayWeight(p.startKg, unit)}</strong>
          <small>初始 · {unit}</small>
        </div>
        <div className="progress-gauge">
          <ProgressGauge ratio={ratio} />
          <div>
            <strong>
              {current ? displayWeight(Math.abs(change), unit) : "—"}
            </strong>
            <small>
              {change < 0 ? "已减" : change > 0 ? "已增" : "体重变化"}（{unit}）
            </small>
          </div>
        </div>
        <div className="plan-value">
          <strong>{displayWeight(p.targetKg, unit)}</strong>
          <small>目标 · {unit}</small>
        </div>
      </div>
      <p className="plan-current">
        {current ? (
          <>
            当前 {displayWeight(current.weightKg, unit)} {unit}
            <span> · {current.date}</span>
          </>
        ) : (
          "等待体重记录"
        )}
      </p>
      <p className="hint">
        体重进度 {Math.round(ratio * 100)}% · 时间进度{" "}
        {Math.min(100, Math.round((elapsed / days) * 100))}%
      </p>
    </div>
  );
}
export function HomeStack({
  data,
  today,
  lean = false,
}: {
  data: Snapshot;
  today: string;
  lean?: boolean;
}) {
  const hasPlan = !!data.profile?.weightPlan,
    available = hasPlan
      ? (data.profile?.widgets ?? ["quote", "weight"])
      : ["quote"],
    widgets = available.length ? available : ["quote"];
  const [active, setActive] = useViewState<string | undefined>(
    "home.widget",
    undefined,
  );
  const [edit, setEdit] = useState(false),
    [editDone, setEditDone] = useState(false),
    [draft, setDraft] = useState<("quote" | "weight")[]>([]),
    [error, setError] = useState("");
  const at = active && widgets.includes(active) ? widgets.indexOf(active) : 0;
  const setIndex = (i: number) => setActive(widgets[i] ?? widgets[0]);
  useEffect(() => {
    if (active && !widgets.includes(active)) setActive(widgets[0]);
  }, [active, widgets.join("|"), setActive]);
  const start = useRef<{
      x: number;
      y: number;
      axis: "x" | "y";
      active: boolean;
    } | null>(null),
    stage = useRef<HTMLDivElement>(null);
  const reset = () => {
    stage.current?.style.removeProperty("--drag");
    if (stage.current) delete stage.current.dataset.dragging;
  };
  const begin = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    const axis = "y";
    if (widgets.length < 2 || (e.target as HTMLElement).closest("button,input"))
      return;
    if (stage.current) stage.current.dataset.axis = axis;
    start.current = { x: e.clientX, y: e.clientY, axis, active: false };
  };
  const move = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x,
      dy = e.clientY - s.y,
      d = s.axis === "x" ? dx : dy,
      cross = s.axis === "x" ? dy : dx;
    if (!s.active) {
      if (Math.abs(cross) > 10 && Math.abs(cross) > Math.abs(d)) {
        start.current = null;
        return;
      }
      if (Math.abs(d) < 10) return;
      s.active = true;
      if (stage.current) stage.current.dataset.dragging = "true";
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    stage.current?.style.setProperty(
      "--drag",
      Math.max(-90, Math.min(90, d)) + "px",
    );
  };
  const end = (e: PointerEvent) => {
    const s = start.current;
    start.current = null;
    reset();
    if (!s?.active) return;
    const d = s.axis === "x" ? e.clientX - s.x : e.clientY - s.y;
    if (Math.abs(d) > 38)
      setIndex(
        Math.max(0, Math.min(widgets.length - 1, at + (d < 0 ? 1 : -1))),
      );
  };
  const quote = data.dailyQuotes.find((q) => q.date === today);
  if (!hasPlan) return <DailyQuoteCard quote={quote} />;
  return (
    <section
      className={"home-stack compact-stack" + (lean ? " lean-stack" : "")}
      aria-label="首页卡片"
    >
      <div
        className="stack-window"
        ref={stage}
        data-multiple={widgets.length > 1}
        onPointerDown={lean ? undefined : begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          start.current = null;
          reset();
        }}
      >
        <div className="quote-size-reference" aria-hidden="true" inert>
          <DailyQuoteCard quote={quote} />
        </div>
        {widgets.map((w, i) => (
          <div
            className="stack-slide"
            key={w}
            inert={!lean && i !== at}
            aria-hidden={!lean && i !== at}
            style={{ "--offset": (i - at) * 100 + "%" } as React.CSSProperties}
          >
            {w === "quote" ? (
              <DailyQuoteCard quote={quote} />
            ) : (
              <WeightProgress data={data} />
            )}
          </div>
        ))}
      </div>
      <div className="stack-controls">
        <div>
          {widgets.length > 1 &&
            widgets.map((w, i) => (
              <button
                key={w}
                aria-label={w === "quote" ? "显示每日一句" : "显示体重进度"}
                aria-pressed={i === at}
                onClick={() => {
                  reset();
                  setIndex(i);
                }}
              >
                <span />
              </button>
            ))}
        </div>
        <button
          className="text-button"
          onClick={() => {
            setDraft(widgets as ("quote" | "weight")[]);
            setEditDone(false);
            setEdit(true);
          }}
        >
          编辑卡片
        </button>
      </div>
      {edit && (
        <Modal
          title="编辑首页卡片"
          onClose={() => setEdit(false)}
          closeRequested={editDone}
        >
          <p className="hint">第一项为默认卡片，至少保留一张</p>
          {(["quote", "weight"] as const).map((w) => (
            <div className="widget-row" key={w}>
              <label>
                <input
                  type="checkbox"
                  checked={draft.includes(w)}
                  onChange={(e) =>
                    setDraft((s) =>
                      e.target.checked
                        ? [...s, w]
                        : s.length > 1
                          ? s.filter((x) => x !== w)
                          : s,
                    )
                  }
                />
                {w === "quote" ? "每日一句" : "体重管理进度"}
              </label>
              {draft.includes(w) && (
                <button
                  disabled={draft[0] === w}
                  onClick={() =>
                    setDraft((s) => [w, ...s.filter((x) => x !== w)])
                  }
                >
                  设为默认
                </button>
              )}
            </div>
          ))}
          {error && <p role="alert">{error}</p>}
          <button
            className="primary"
            onClick={async () => {
              try {
                await updateProfile({ widgets: draft });
                setActive(draft[0] ?? "quote");
                setEditDone(true);
              } catch {
                setError("卡片设置保存失败");
              }
            }}
          >
            保存卡片
          </button>
        </Modal>
      )}
    </section>
  );
}
