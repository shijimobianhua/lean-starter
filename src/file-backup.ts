import { backupFiles } from "./backup-files";
import type { Snapshot } from "./records";
import { localDate } from "./records";
import { getSetting, setSetting } from "./recovery";
export interface BackupDirectory {
  name: string;
  queryPermission: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (
    name: string,
    o: { create: true },
  ) => Promise<{
    createWritable: () => Promise<{
      write: (value: Blob | string) => Promise<void>;
      close: () => Promise<void>;
      abort?: () => Promise<void>;
    }>;
  }>;
}
export const folderSupported = () =>
  typeof (window as Window & { showDirectoryPicker?: unknown })
    .showDirectoryPicker === "function";
export async function chooseFolder() {
  const pick = (
    window as unknown as Window & {
      showDirectoryPicker: (o: {
        mode: "readwrite";
        id: string;
      }) => Promise<BackupDirectory>;
    }
  ).showDirectoryPicker;
  const handle = await pick.call(window, {
    mode: "readwrite",
    id: "thin-daily-backups",
  });
  await setSetting("backup-directory", handle);
  try {
    await writeFolderBackup();
  } catch (e) {
    throw e;
  }
}
let writing: Promise<void> | undefined;
export async function writeFolderBackup(data?: Snapshot): Promise<void> {
  if (writing) {
    await writing.catch(() => {});
    return writeFolderBackup(data);
  }
  writing = (async () => {
    const handle = await getSetting<BackupDirectory>("backup-directory");
    if (!handle) return;
    try {
      if ((await handle.queryPermission({ mode: "readwrite" })) !== "granted")
        throw Error("文件夹备份已暂停，请重新授权");
      const instance =
        (await getSetting<string>("backup-instance")) ??
        crypto.randomUUID().slice(0, 8);
      await setSetting("backup-instance", instance);
      const batch = crypto.randomUUID().slice(0, 8);
      for await (const part of backupFiles(data)) {
        const file = await handle.getFileHandle(
          part.name.replace(".json", "-" + instance + "-" + batch + ".json"),
          { create: true },
        );
        const stream = await file.createWritable();
        try {
          await stream.write(part);
          await stream.close();
        } catch (e) {
          await stream.abort?.();
          throw e;
        }
      }
      await setSetting("folder-backup-status", {
        at: Date.now(),
        name: handle.name,
        error: "",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "本地文件写入失败";
      await setSetting("folder-backup-status", {
        name: handle.name,
        error: message,
      });
      throw e;
    }
  })().finally(() => {
    writing = undefined;
  });
  return writing;
}
export async function reconnectFolder() {
  const handle = await getSetting<BackupDirectory>("backup-directory");
  if (!handle) throw Error("请先选择备份文件夹");
  if ((await handle.requestPermission({ mode: "readwrite" })) !== "granted")
    throw Error("未获得文件夹写入授权");
  await writeFolderBackup();
}
export async function disconnectFolder() {
  await setSetting("backup-directory", undefined);
  await setSetting("folder-backup-status", undefined);
}
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function stopFolderBackups() {
  await writing?.catch(() => {});
  await disconnectFolder();
}
