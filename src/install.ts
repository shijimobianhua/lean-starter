import { useSyncExternalStore } from "react";
export interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let deferred: InstallEvent | null = null,
  installed = false;
let revision = 0;
const listeners = new Set<() => void>();
const emit = () => {
  revision++;
  listeners.forEach((f) => f());
};
export function startInstallCapture() {
  const prompt = (e: Event) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  };
  const done = () => {
    installed = true;
    deferred = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", prompt);
  window.addEventListener("appinstalled", done);
  return () => {
    window.removeEventListener("beforeinstallprompt", prompt);
    window.removeEventListener("appinstalled", done);
  };
}
export function useInstall() {
  const available = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => revision,
  );
  return {
    event: deferred,
    installed:
      installed ||
      matchMedia("(display-mode: standalone)").matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone,
  };
}
export async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  emit();
  await event.prompt();
  const result = await event.userChoice;
  if (result.outcome === "accepted") installed = true;
  emit();
  return result.outcome === "accepted";
}
