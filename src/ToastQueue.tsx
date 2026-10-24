import { useEffect, useState } from "react";
export function ToastQueue() {
  const [queue, setQueue] = useState<{ id: string; text: string }[]>([]),
    [leaving, setLeaving] = useState(false),
    [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const on = (e: Event) =>
      setQueue((q) =>
        [
          ...q,
          { id: crypto.randomUUID(), text: (e as CustomEvent<string>).detail },
        ].slice(-3),
      );
    window.addEventListener("daily-toast", on);
    const watch = new MutationObserver(() =>
      setBlocked(!!document.documentElement.dataset.modalOpen),
    );
    watch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-modal-open"],
    });
    const panel = document.querySelector<HTMLElement>(".pwa-status");
    const measure = () =>
      document.documentElement.style.setProperty(
        "--pwa-panel-height",
        (panel?.getBoundingClientRect().height ?? 0) + "px",
      );
    const size =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : undefined;
    if (panel) size?.observe(panel);
    measure();
    return () => {
      size?.disconnect();
      window.removeEventListener("daily-toast", on);
      watch.disconnect();
    };
  }, []);
  const id = queue[0]?.id;
  useEffect(() => {
    if (!id || blocked) return;
    setLeaving(false);
    const a = setTimeout(() => setLeaving(true), 2000),
      b = setTimeout(() => {
        setQueue((q) => q.slice(1));
        setLeaving(false);
      }, 2350);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [id, blocked]);
  if (!queue.length || blocked) return null;
  return (
    <div
      role="status"
      className={"app-toast" + (leaving ? " leaving" : "")}
      key={id}
    >
      <span>{queue[0].text}</span>
      <button
        aria-label="关闭消息"
        onClick={() => {
          setQueue((q) => q.slice(1));
          setLeaving(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
