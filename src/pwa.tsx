import { APP_VERSION } from "./version";
import { promptInstall } from "./install";
import { createCheckpoint } from "./recovery";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaStatus({
  onCacheReady,
  blocked = false,
}: {
  onCacheReady?: (ready: boolean) => void;
  blocked?: boolean;
}) {
  const [protecting, setProtecting] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [cached, setCached] = useState(false),
    [error, setError] = useState(""),
    [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [refresh],
    offlineReady: [ready],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      setRegistration(r);
    },
    onRegisterError() {
      setError("离线缓存暂未就绪，请联网重试；当前仍可在线记录。");
    },
  });
  useEffect(() => {
    let alive = true;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.ready
        .then(() => {
          if (alive) setCached(true);
        })
        .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", prompt);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine && !document.hidden)
        void registration.update().catch(() => {});
    };
    check();
    const interval = setInterval(check, 30 * 60 * 1000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [registration]);
  useEffect(() => {
    onCacheReady?.(cached || ready);
  }, [cached, ready, onCacheReady]);
  return (
    <div
      className="pwa-status"
      hidden={blocked}
      aria-label="应用更新与安装"
      data-current-version={APP_VERSION}
    >
      {error && <span className="error">{error}</span>}
      {refresh && (
        <button
          disabled={protecting}
          title={
            "当前运行 v" + APP_VERSION + "，确认更新并重新加载后切换到新版本"
          }
          onClick={async () => {
            if (
              protecting ||
              !window.confirm(
                "更新会刷新页面，请先保存未提交的输入。现在更新？",
              )
            )
              return;
            setProtecting(true);
            try {
              await createCheckpoint("更新前的恢复副本");
              await updateServiceWorker(true);
            } catch {
              setError(
                "更新已暂停：恢复副本未能建立，请先导出备份并检查剩余空间后重试",
              );
            } finally {
              setProtecting(false);
            }
          }}
        >
          {protecting ? "正在保护数据…" : "新版本已就绪，点击更新"}
        </button>
      )}

      {install && (
        <button
          onClick={async () => {
            try {
              await promptInstall();
              setInstall(null);
            } catch {
              setError("安装未完成，可使用浏览器菜单添加到主屏幕。");
            }
          }}
        >
          安装到此设备
        </button>
      )}
    </div>
  );
}
