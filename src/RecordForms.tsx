import { useState } from "react";
import { saveHeight, type Snapshot } from "./records";
export type Run = (
  action: () => Promise<unknown>,
  success: string,
) => Promise<boolean>;
export function HeightForm({ data, run }: { data: Snapshot; run: Run }) {
  const [h, setH] = useState(String(data.profile?.heightCm ?? "")),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await run(() => saveHeight(h), "身高已保存，历史 BMI 已重新计算");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>身体资料</h2>
      <p className="hint">用于计算 BMI。</p>
      <label>
        身高（cm）
        <input
          required
          type="number"
          min="50"
          max="260"
          step="0.1"
          value={h}
          onChange={(e) => setH(e.target.value)}
        />
      </label>
      <button className="primary" disabled={busy}>
        保存身高
      </button>
    </form>
  );
}
