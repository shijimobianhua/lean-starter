import { clearWelcomeDraft } from "./ui-style";
import { clearAllDrafts } from "./drafts";
import { useState } from "react";
import { stopFolderBackups } from "./file-backup";
import { db } from "./data";
import { recoveryDb } from "./recovery";
import { Modal } from "./Modal";
import type { Run } from "./RecordForms";
export async function resetLocalData() {
  // Close external backup access first; no filesystem files are removed.
  await stopFolderBackups();
  clearAllDrafts();
  clearWelcomeDraft();
  await recoveryDb.settings.clear();
  await recoveryDb.checkpoints.clear();
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  for (const key of ["form-theme", "form-style", "daily-last-record-count"])
    localStorage.removeItem(key);
}
export function ResetPanel({
  run,
  onReset,
}: {
  run: Run;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="panel full-button reset-entry"
        onClick={() => setOpen(true)}
      >
        <strong>做空回调</strong>
        <span>清空本机记录，重新开始加仓！</span>
      </button>
      {open && (
        <Modal
          title="确定重新开始？"
          onClose={() => setOpen(false)}
          canClose={() => !busy}
        >
          <p>
            将删除本机全部记录、照片、句库、个人设置及恢复副本，并解除文件夹备份关联。已保存到手机或电脑的备份文件保留。
          </p>
          <p className="hint">无法撤销，建议先取消并导出完整备份。</p>
          <div className="action-row">
            <button disabled={busy} onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              className="primary danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                if (await run(resetLocalData, "本机数据已清空")) onReset();
                else setBusy(false);
              }}
            >
              {busy ? "正在清空…" : "确认清空"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
