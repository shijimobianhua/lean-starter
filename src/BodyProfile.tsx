import { BodyContour } from "./LeanArt";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { askConfirm } from "./confirm";
import { updateProfile } from "./units";
import {
  measurementFields,
  validateMeasurement,
  type MeasurementKey,
} from "./body-measurements";
import type { Snapshot } from "./records";
import type { Run } from "./RecordForms";

export function BodyProfile({
  data,
  run,
  onActiveChange,
  lean = false,
}: {
  data: Snapshot;
  run: Run;
  onActiveChange?: (active: boolean) => void;
  lean?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    onActiveChange?.(open);
    return () => onActiveChange?.(false);
  }, [open, onActiveChange]);
  const count = measurementFields.filter(
    (f) => data.profile?.[f.key] != null,
  ).length;
  return (
    <>
      <button
        className={"panel settings-entry" + (lean ? " lean-body-profile" : "")}
        onClick={() => setOpen(true)}
      >
        {lean && <BodyContour className="lean-body-art" />}
        <span className="body-profile-copy">
          身体资料{lean && <small>身高与三围 · 私密查看</small>}
        </span>
        <span className="entry-side">
          {count ? `已填写 ${count} 项` : "身高与三围"}
          <span aria-hidden="true"> ›</span>
        </span>
      </button>
      {open && (
        <BodyForm data={data} run={run} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
function BodyForm({
  data,
  run,
  onClose,
}: {
  data: Snapshot;
  run: Run;
  onClose: () => void;
}) {
  const [initial] = useState(
    () =>
      Object.fromEntries(
        measurementFields.map((f) => [
          f.key,
          String(data.profile?.[f.key] ?? ""),
        ]),
      ) as Record<MeasurementKey, string>,
  );
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const dirty = measurementFields.some((f) => values[f.key] !== initial[f.key]);
  return (
    <Modal
      title="身体资料"
      className="body-profile-modal settings-modal"
      onClose={onClose}
      closeRequested={done}
      canClose={() =>
        !busy && (!dirty || askConfirm("身体资料尚未保存，确定放弃修改？"))
      }
    >
      <p className="hint">
        均为选填，单位 cm。身高用于计算 BMI；三围仅保存在本机个人资料中。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const parsed = Object.fromEntries(
              measurementFields.map((f) => [
                f.key,
                values[f.key].trim()
                  ? validateMeasurement(f.key, values[f.key])
                  : f.key === "heightCm"
                    ? undefined
                    : null,
              ]),
            );
            const ok = await run(() => updateProfile(parsed), "身体资料已保存");
            if (ok) setDone(true);
            else setError("保存未完成，输入已保留，请重试。");
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存失败，请重试。");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="body-measurement-grid">
          {measurementFields.map((f) => (
            <label key={f.key}>
              {f.label}（cm）
              <input
                type="number"
                inputMode="decimal"
                min={f.min}
                max={f.max}
                step="0.1"
                placeholder="选填"
                value={values[f.key]}
                onChange={(e) =>
                  setValues((p) => ({ ...p, [f.key]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <p className="hint">
          清空三围后保存即可移除该项；不进行身体评分，也不会自动展示在分享卡中。
        </p>
        {error && (
          <p role="alert" className="feedback error">
            {error}
          </p>
        )}
        <div className="share-actions">
          <button className="primary" disabled={busy}>
            保存身体资料
          </button>
        </div>
      </form>
    </Modal>
  );
}
