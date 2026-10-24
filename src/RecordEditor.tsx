import { TrainingEditor } from "./TrainingEditor";
import { useWeightUnit } from "./units";
import { toDisplay, toKg } from "./domain";
import { askConfirm } from "./confirm";
import { useEffect, useState, type FormEvent } from "react";
import { useMuscle } from "./Onboarding";
import { db } from "./data";
import { useModal } from "./Modal";
import {
  saveWeight,
  saveWater,
  saveSleepForDay,
  saveTraining,
  makeSleepForDay,
  sleepHours,
  localDate,
  shiftDate,
  type Snapshot,
} from "./records";
import type { Run } from "./RecordForms";
export type RecordKind = "大水" | "大睡" | "薄肌" | "体重";
function LegacyRecordEditor({
  kind,
  date,
  data,
  run,
  onClose,
}: {
  kind: RecordKind;
  date: string;
  data: Snapshot;
  run: Run;
  onClose: () => void;
}) {
  const muscle = useMuscle(),
    unit = useWeightUnit();
  const [slot, setSlot] = useState(
    new Date().getHours() < 11 ? 0 : new Date().getHours() < 18 ? 1 : 2,
  );
  const water = data.water.find((r) => r.date === date),
    weight = data.weights.find((r) => r.date === date),
    sleep = data.sleep.find((r) => r.wakeDate === date),
    training = data.training.find((r) => r.date === date);
  const [amounts, setAmounts] = useState([
      water?.morningMl ?? 0,
      water?.noonMl ?? 0,
      water?.eveningMl ?? 0,
    ]),
    [undo, setUndo] = useState<number[][]>([]),
    [weightValue, setWeight] = useState(
      weight ? String(toDisplay(weight.weightKg, unit)) : "",
    );
  const [waterDraft, setWaterDraft] = useState(
    amounts.map((v) => String(Number((v / 1500).toFixed(3)))),
  );
  const time = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return (
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  };
  const [start, setStart] = useState(time(sleep?.startAt)),
    [end, setEnd] = useState(time(sleep?.endAt)),
    [confirmed, setConfirmed] = useState(false),
    [status, setStatus] = useState<"trained" | "rest">(
      training?.status ?? "trained",
    ),
    [aerobic, setAerobic] = useState(training?.aerobic ?? ""),
    [anaerobic, setAnaerobic] = useState(training?.anaerobic ?? "");
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const modal = useModal(
    onClose,
    () => !busy && (!dirty || askConfirm("还有未保存的修改，确定放弃？")),
  );
  const close = () => modal.dismiss();
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const updateWater = (index: number, delta: number) => {
    const next = [...amounts];
    next[index] = Math.max(0, Math.min(10000, next[index] + delta));
    setUndo((s) => [...s.slice(-49), amounts]);
    setAmounts(next);
    setWaterDraft(next.map((v) => String(Number((v / 1500).toFixed(3)))));
    setDirty(true);
  };
  let preview: ReturnType<typeof makeSleepForDay> | undefined,
    previewError = "";
  if (start && end) {
    try {
      preview = sleep && !dirty ? sleep : makeSleepForDay(date, start, end);
    } catch (e) {
      previewError = e instanceof Error ? e.message : "时间无效";
    }
  }
  const units = (ml: number) => Number((ml / 1500).toFixed(3));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (
      kind === "大睡" &&
      preview &&
      sleepHours(preview) > 16 &&
      !confirmed &&
      (dirty || !sleep)
    ) {
      setError("时长超过 16 小时，请确认日期与时间后勾选确认。");
      return;
    }
    setBusy(true);
    try {
      const ok = await run(
        async () => {
          try {
            if (kind === "大水") await saveWater(date, amounts);
            else if (kind === "大睡") {
              if (sleep && !dirty) await db.sleep.put(sleep);
              else await saveSleepForDay(date, start, end);
            } else if (kind === "体重")
              await saveWeight(date, toKg(Number(weightValue), unit));
            else await saveTraining(date, status, aerobic, anaerobic);
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存失败，请重试");
            throw e;
          }
        },
        (kind === "薄肌" ? muscle : kind) + "已保存",
      );
      if (ok) modal.dismiss(true);
    } finally {
      setBusy(false);
    }
  }
  const exists =
    kind === "大水"
      ? water
      : kind === "大睡"
        ? sleep
        : kind === "体重"
          ? weight
          : training;
  return (
    <dialog
      ref={modal.ref}
      {...modal.handlers}
      className={
        "record-dialog app-modal" +
        (kind === "大水" ? " compact-water" : "") +
        (modal.closing ? " is-closing" : "")
      }
      aria-labelledby="editor-title"
    >
      <div className="editor-head">
        <div>
          <span className="eyebrow">
            {date === localDate() ? "今天" : date}
          </span>
          <h2 id="editor-title">{kind === "薄肌" ? muscle : kind}记录</h2>
        </div>
        <button
          type="button"
          className="small-button"
          aria-label="关闭记录"
          onClick={close}
          disabled={busy}
        >
          关闭
        </button>
      </div>
      <p className="hint">
        {date} {kind === "大睡" ? "· 起床日" : "· 再次保存会更新当天记录"}
      </p>
      <form
        onSubmit={submit}
        onChange={() => {
          setDirty(true);
          setError("");
        }}
      >
        {kind === "大水" && (
          <>
            <div className="segments" aria-label="大水时段">
              {["早上", "中午", "晚上"].map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={slot === i}
                  onClick={() => setSlot(i)}
                >
                  {name}
                </button>
              ))}
            </div>
            <label>
              大水量
              <input
                aria-label="大水量"
                type="number"
                inputMode="decimal"
                min="0"
                max="6.667"
                step="any"
                required
                value={waterDraft[slot]}
                onChange={(e) => {
                  const raw = e.target.value;
                  setWaterDraft((a) => a.map((v, i) => (i === slot ? raw : v)));
                  const n = Number(raw);
                  if (Number.isFinite(n)) {
                    setUndo((s) => [...s.slice(-49), amounts]);
                    setAmounts((a) =>
                      a.map((v, i) => (i === slot ? Math.round(n * 1500) : v)),
                    );
                  }
                }}
              />
            </label>
            <p className="conversion">
              <strong>{units(amounts[slot])} 大水</strong>
              <span>≈ {amounts[slot]} ml</span>
            </p>
            <div className="water-actions">
              {[0.1, 0.2, 0.5, -0.1].map((v) => (
                <button
                  key={v}
                  type="button"
                  className="small-button"
                  disabled={v < 0 && amounts[slot] === 0}
                  onClick={() => updateWater(slot, Math.round(v * 1500))}
                >
                  {v > 0 ? "+" : ""}
                  {v} 大水
                </button>
              ))}
            </div>
            <p className="hint">
              今日合计 {units(amounts.reduce((a, b) => a + b, 0))} 大水 · 1 大水
              = 1500 ml
            </p>
            <button
              type="button"
              className="text-button"
              disabled={!undo.length}
              onClick={() => {
                setAmounts(undo[undo.length - 1]);
                setWaterDraft(
                  undo[undo.length - 1].map((v) =>
                    String(Number((v / 1500).toFixed(3))),
                  ),
                );
                setUndo((s) => s.slice(0, -1));
                setDirty(true);
              }}
            >
              撤销上一步
            </button>
          </>
        )}
        {kind === "大睡" && (
          <>
            <div className="time-fields">
              <label>
                入睡时分
                <input
                  required
                  type="time"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
              <label>
                起床时分
                <input
                  required
                  type="time"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </label>
            </div>
            {preview && (
              <div className="sleep-preview">
                {localDate(new Date(preview.startAt)) === date
                  ? "当天"
                  : localDate(new Date(preview.startAt)) === shiftDate(date, -1)
                    ? "前一天"
                    : localDate(new Date(preview.startAt))}{" "}
                {start} → {date} {end}
                <strong>共 {sleepHours(preview).toFixed(1)} 小时</strong>
              </div>
            )}
            {previewError && <p className="hint">{previewError}</p>}
            {preview && sleepHours(preview) > 16 && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                我已核对，这段大睡时长正确
              </label>
            )}
          </>
        )}
        {kind === "薄肌" && (
          <>
            <div className="segments" aria-label="训练状态">
              <button
                type="button"
                aria-pressed={status === "trained"}
                onClick={() => {
                  setStatus("trained");
                  setDirty(true);
                }}
              >
                今天练了
              </button>
              <button
                type="button"
                aria-pressed={status === "rest"}
                onClick={() => {
                  setStatus("rest");
                  setDirty(true);
                }}
              >
                今日休息
              </button>
            </div>
            {status === "trained" ? (
              <>
                <label>
                  有氧训练
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={aerobic}
                    placeholder="例如：慢跑 20 分钟，可只写练了什么"
                    onChange={(e) => setAerobic(e.target.value)}
                  />
                </label>
                <label>
                  无氧训练
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={anaerobic}
                    placeholder="例如：深蹲、俯卧撑"
                    onChange={(e) => setAnaerobic(e.target.value)}
                  />
                </label>
              </>
            ) : null}
          </>
        )}
        {kind === "体重" && (
          <>
            <label>
              体重（{unit}）
              <input
                autoFocus
                required
                inputMode="decimal"
                type="number"
                min={toDisplay(20, unit)}
                max={toDisplay(500, unit)}
                step="0.1"
                value={weightValue}
                onChange={(e) => setWeight(e.target.value)}
              />
            </label>
          </>
        )}
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <button className="primary" disabled={busy}>
            {busy ? "保存中…" : "保存" + (kind === "薄肌" ? muscle : kind)}
          </button>
          {exists && (
            <button
              type="button"
              className="text-button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await askConfirm(
                    "删除 " +
                      date +
                      " 的" +
                      (kind === "薄肌" ? muscle : kind) +
                      "记录？",
                    "删除记录",
                  ))
                )
                  return;
                setBusy(true);
                try {
                  const ok = await run(
                    () =>
                      kind === "大水"
                        ? db.water.delete(date)
                        : kind === "大睡"
                          ? db.sleep.delete(date)
                          : kind === "薄肌"
                            ? db.training.delete(date)
                            : db.weights.delete(date),
                    (kind === "薄肌" ? muscle : kind) + "记录已删除",
                  );
                  if (ok) modal.dismiss(true);
                  else setError("删除失败，请重试。");
                } finally {
                  setBusy(false);
                }
              }}
            >
              删除此记录
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

export function RecordEditor(props: Parameters<typeof LegacyRecordEditor>[0]) {
  return props.kind === "薄肌" ? (
    <TrainingEditor {...props} />
  ) : (
    <LegacyRecordEditor {...props} />
  );
}
