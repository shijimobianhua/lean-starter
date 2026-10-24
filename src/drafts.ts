import { useEffect, useRef, useState } from "react";

const prefix = "daily-draft:";
export function readDraft<T>(key: string): T | undefined {
  try {
    const row = JSON.parse(localStorage.getItem(prefix + key) ?? "null");
    if (row && Date.now() - row.at < 30 * 86400000) return row.value as T;
  } catch {}
}
export function clearDraft(key: string) {
  try {
    localStorage.removeItem(prefix + key);
  } catch {}
}
export function clearAllDrafts() {
  for (const key of Object.keys(localStorage))
    if (key.startsWith(prefix)) localStorage.removeItem(key);
}
// Small, local form drafts only; photos never enter localStorage.
export function useDraftProtection<T>(key: string, value: T, dirty: boolean) {
  const latest = useRef({ value, dirty });
  latest.current = { value, dirty };
  const [error, setError] = useState("");
  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(
        prefix + key,
        JSON.stringify({ at: Date.now(), value }),
      );
      setError("");
    } catch {
      setError("草稿暂未保存在本机，请先保存记录再离开");
    }
  }, [key, value, dirty]);
  useEffect(() => {
    const persist = () => {
      if (!latest.current.dirty) return;
      try {
        localStorage.setItem(
          prefix + key,
          JSON.stringify({ at: Date.now(), value: latest.current.value }),
        );
      } catch {}
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (!latest.current.dirty) return;
      persist();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [key]);
  return error;
}
