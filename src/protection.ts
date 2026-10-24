import { useEffect, useState, useMemo } from "react";
import type { Snapshot } from "./records";
import {
  createCheckpoint,
  dataSignature,
  listCheckpoints,
  recordCount,
  getSetting,
  type Checkpoint,
} from "./recovery";
import { writeFolderBackup } from "./file-backup";
export function useDataProtection(data: Snapshot, loaded: boolean) {
  const [state, setState] = useState<{
    ready: boolean;
    signature?: string;
    candidate?: Checkpoint;
    warning: string;
  }>({ ready: false, warning: "" });
  const signature = useMemo(() => dataSignature(data), [data]);
  useEffect(() => {
    if (!loaded) return;
    let alive = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        const latest = (await listCheckpoints())[0];
        const ignored = await getSetting<string>("ignored-recovery");
        const missing =
          recordCount(data) === 0 && !!latest?.count && latest.id !== ignored;
        let warning = "";
        try {
          if (
            !recordCount(data) &&
            !latest &&
            Number(localStorage.getItem("daily-last-record-count")) > 0
          )
            warning =
              "当前入口未读到历史记录，请检查原浏览器或主屏幕入口，或导入已保存的文件备份";
        } catch {}
        if (alive)
          setState({
            ready: true,
            signature,
            candidate: missing ? latest : undefined,
            warning,
          });
        if (missing) return;
        timer = setTimeout(() => {
          void createCheckpoint("保存后的恢复副本", data).catch(() => {
            if (alive)
              setState((s) => ({
                ...s,
                warning: "恢复副本暂未保存，请导出文件备份",
              }));
          });
        }, 700);
      } catch {
        if (alive)
          setState({
            ready: true,
            signature,
            warning: "本机恢复副本不可用，请导出文件备份",
          });
      }
    })();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [loaded, signature]);
  useEffect(() => {
    if (!loaded || !recordCount(data)) return;
    const timer = setTimeout(() => {
      if (!document.hidden) void writeFolderBackup(data).catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [loaded, signature]);
  return { ...state, checked: state.signature === signature };
}
