import { BackupFileActions } from "./BackupFileActions";
import { useState } from "react";
import {
  backupFiles,
  inspectBackupFiles,
  restoreBackupFiles,
} from "./backup-files";
import type { Run } from "./RecordForms";
import { downloadFile } from "./file-backup";
import { setSetting } from "./recovery";
import { localDate } from "./records";
export function BackupPanel({ run }: { run: Run }) {
  const [prepared, setPrepared] = useState<File[]>([]);
  const [pending, setPending] = useState<{
      files: File[];
      count: number;
    } | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h2>备份与恢复</h2>
      <p className="hint">
        导出包含身高、训练、每日一句、全部日常记录及照片的 JSON
        文件。请妥善保管；清除浏览器数据或更换设备不会自动同步。
      </p>
      <div className="action-row">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await run(async () => {
                const files: File[] = [];
                for await (const file of backupFiles()) files.push(file);
                setPrepared(files);
                if (files.length === 1) downloadFile(files[0]);
                await setSetting("last-file-export", Date.now());
              }, "备份已生成，请确认全部文件已保存");
            } finally {
              setBusy(false);
            }
          }}
        >
          导出完整备份
        </button>
        <label className="upload-button">
          选择备份文件
          <input
            type="file"
            multiple
            accept=".json,application/json"
            disabled={busy}
            aria-label="选择备份文件"
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              setPending(null);
              setBusy(true);
              try {
                await run(async () => {
                  const count = await inspectBackupFiles(files);
                  setPending({ files, count });
                }, "备份校验通过，确认后才会导入");
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
      </div>
      <BackupFileActions files={prepared} />
      {pending && (
        <div className="restore-confirm">
          <p>
            已校验 {pending.count} 条记录。将合并到本机；同日记录及相同照片 ID
            会被备份内容覆盖，其他记录保留。
          </p>
          <div className="action-row">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await run(
                    () => restoreBackupFiles(pending.files),
                    "备份已恢复",
                  );
                  if (ok) setPending(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认合并恢复
            </button>
            <button
              className="small-button"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
