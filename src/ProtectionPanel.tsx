import { Disclosure } from "./FoldSection";
import { askConfirm } from "./confirm";
import { useEffect, useState } from "react";
import {
  createCheckpoint,
  listCheckpoints,
  requestPersistence,
  setSetting,
  getSetting,
  type Checkpoint,
} from "./recovery";
import { backupFiles, restoreBackupFiles } from "./backup-files";
import { BackupFileActions } from "./BackupFileActions";
import {
  chooseFolder,
  reconnectFolder,
  disconnectFolder,
  folderSupported,
  downloadFile,
} from "./file-backup";
import type { Run } from "./RecordForms";
export function RecoveryNotice({
  candidate,
  onDismiss,
  run,
}: {
  candidate: Checkpoint;
  onDismiss: () => void;
  run: Run;
}) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <section className="recovery-notice" role="alert">
      <h2>发现可恢复的历史记录</h2>
      <p>
        当前记录为空，本机恢复副本中有 {candidate.count}{" "}
        条。请先恢复或导出，避免当成新用户重新开始。
      </p>
      <div className="action-row">
        <button
          className="primary"
          onClick={() =>
            void run(async () => {
              await restoreCheckpoint(candidate);
              onDismiss();
            }, "历史记录已恢复")
          }
        >
          恢复历史记录
        </button>
        <button
          onClick={() =>
            void run(
              async () => downloadCheckpoint(candidate, setFiles),
              "恢复文件已生成",
            )
          }
        >
          导出恢复文件
        </button>
        <button
          onClick={() =>
            void run(async () => {
              await setSetting("ignored-recovery", candidate.id);
              onDismiss();
            }, "已保留恢复副本")
          }
        >
          继续使用当前数据
        </button>
      </div>
      <BackupFileActions files={files} />
    </section>
  );
}
async function prepareCheckpoint(row: Checkpoint) {
  const files: File[] = [];
  for await (const file of backupFiles(row.data)) files.push(file);
  return files;
}
async function restoreCheckpoint(row: Checkpoint) {
  return restoreBackupFiles(await prepareCheckpoint(row));
}
async function downloadCheckpoint(
  row: Checkpoint,
  setFiles: (files: File[]) => void,
) {
  const files = await prepareCheckpoint(row);
  setFiles(files);
  if (files.length === 1) downloadFile(files[0]);
}
export function ProtectionPanel({ run }: { run: Run }) {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Checkpoint[]>([]),
    [persistent, setPersistent] = useState<boolean | undefined>(),
    [status, setStatus] = useState<{
      at?: number;
      name?: string;
      error?: string;
    }>(),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const [r, s, p] = await Promise.all([
          listCheckpoints(),
          getSetting<{ at?: number; name?: string; error?: string }>(
            "folder-backup-status",
          ),
          navigator.storage?.persisted?.(),
        ]);
        if (alive) {
          setRows(r);
          setStatus(s);
          setPersistent(p);
        }
      } catch {}
    };
    void refresh();
    window.addEventListener("daily-protection-change", refresh);
    return () => {
      alive = false;
      window.removeEventListener("daily-protection-change", refresh);
    };
  }, []);
  const act = async (action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await run(async () => {
        await action();
      }, message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel protection-panel">
      <h2>数据保护</h2>
      <p className="hint">
        更新会保留记录。恢复副本仍在浏览器内；要在删除应用或清除网站数据后找回，请把完整备份保存到「文件」或电脑文件夹。
      </p>
      <div className="action-row">
        <button
          disabled={busy}
          onClick={() =>
            void act(() => createCheckpoint("手动恢复副本"), "恢复副本已检查")
          }
        >
          建立恢复副本
        </button>
        <button
          disabled={busy || persistent === true}
          onClick={() =>
            void act(async () => {
              const granted = await requestPersistence();
              setPersistent(granted);
              if (!granted)
                throw Error("浏览器暂未授予持久保存；请使用文件备份");
            }, "已启用持久保存")
          }
        >
          {persistent ? "已启用持久保存" : "申请持久保存"}
        </button>
      </div>
      {folderSupported() && (
        <>
          <p className="hint">
            授权后，页面打开时在记录变更后自动保存完整备份；关闭页面时不会后台运行。按日保留文件，照片也包含在内。
          </p>
          <div className="action-row">
            <button
              disabled={busy}
              onClick={() => void act(chooseFolder, "备份文件夹已连接")}
            >
              选择备份文件夹
            </button>
            {status?.name && (
              <>
                <button
                  disabled={busy}
                  onClick={() => void act(reconnectFolder, "文件夹备份已更新")}
                >
                  重新授权并备份
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(disconnectFolder, "已停止文件夹备份，原文件保留")
                  }
                >
                  停止文件夹备份
                </button>
              </>
            )}
          </div>
          {status && (
            <p className="hint" role={status.error ? "alert" : "status"}>
              {status.error ||
                "已保存至 " +
                  status.name +
                  " · " +
                  new Date(status.at!).toLocaleString()}
            </p>
          )}
        </>
      )}
      <Disclosure>
        <summary>本机恢复副本 · {rows.length} 份</summary>
        <p className="hint">
          保留最近三份变化。恢复会合并记录，同日记录以副本为准。
        </p>
        {rows.map((row) => (
          <div className="recovery-row" key={row.id}>
            <p>
              {new Date(row.createdAt).toLocaleString()} · {row.count} 条 ·{" "}
              {row.reason}
            </p>
            <div className="action-row">
              <button
                disabled={busy}
                onClick={() =>
                  void act(
                    () => downloadCheckpoint(row, setFiles),
                    "恢复文件已生成",
                  )
                }
              >
                导出文件
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await askConfirm(
                      "合并这份恢复副本？同日记录会以副本为准。",
                      "合并恢复",
                    )
                  )
                    void act(
                      async () => restoreCheckpoint(row),
                      "恢复副本已合并",
                    );
                }}
              >
                合并恢复
              </button>
            </div>
          </div>
        ))}
      </Disclosure>
      <BackupFileActions files={files} />
      <Disclosure>
        <summary>存储与备份说明</summary>
        <p className="hint">
          数据按访问地址和浏览器保存，Safari
          与主屏幕应用可能使用不同存储环境。请使用同一入口；迁移前导出文件。持久保存降低自动清理风险，不能抵抗手动清除网站数据。iPhone
          可在上方生成备份后通过分享存入「文件」。
        </p>
        <p className="hint">
          当前地址：{location.origin} ·{" "}
          {window.matchMedia("(display-mode: standalone)").matches
            ? "主屏幕应用"
            : "浏览器"}
        </p>
      </Disclosure>
    </section>
  );
}
