import { downloadFile } from "./file-backup";
export function BackupFileActions({ files }: { files: File[] }) {
  if (!files.length) return null;
  return (
    <div className="backup-downloads">
      {files.length > 1 && (
        <p className="hint">
          已生成 {files.length} 个分卷。请逐个保存；恢复时一次选齐全部分卷。
        </p>
      )}
      {files.map((file) => (
        <div key={file.name} className="backup-file-actions">
          <button className="small-button" onClick={() => downloadFile(file)}>
            保存 {file.name}
          </button>
          {typeof navigator.share === "function" &&
            navigator.canShare?.({ files: [file] }) && (
              <button
                className="small-button"
                onClick={async () => {
                  try {
                    await navigator.share({
                      files: [file],
                      title: "薄肌 LEAN 完整备份",
                    });
                  } catch (e) {
                    if (!(e instanceof DOMException && e.name === "AbortError"))
                      window.dispatchEvent(
                        new CustomEvent("daily-toast", {
                          detail: "文件尚未分享成功，请重新保存",
                        }),
                      );
                  }
                }}
              >
                分享备份 / 存储到文件
                {files.length > 1
                  ? " · " + file.name.match(/分卷-\d+/)?.[0]
                  : ""}
              </button>
            )}
        </div>
      ))}
    </div>
  );
}
