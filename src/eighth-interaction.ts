import { useEffect, useRef } from "react";
export function useNativeInteractions() {
  useEffect(() => {
    let drag:
        | {
            group: HTMLElement;
            x: number;
            y: number;
            id: number;
            active: boolean;
          }
        | undefined,
      block: HTMLElement | undefined,
      frame = 0;
    const settling = new Map<HTMLElement, Animation>();
    const selector = ".bottom-nav,.segments,.range-pills,.theme-options";
    const down = (e: PointerEvent) => {
      const el = e.target as Element;
      if (e.button !== 0 || !e.isPrimary) return;
      const group = el.closest<HTMLElement>(selector);
      if (group)
        drag = {
          group,
          x: e.clientX,
          y: e.clientY,
          id: e.pointerId,
          active: false,
        };
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          drag = undefined;
          return;
        }
        if (Math.abs(dx) < 8) return;
        drag.active = true;
        drag.group.setPointerCapture?.(e.pointerId);
        drag.group.dataset.dragging = "true";
      }
      e.preventDefault();
      const g = drag.group,
        buttons = Array.from(
          g.querySelectorAll<HTMLButtonElement>(":scope > button"),
        ),
        r = g.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const stage = g.matches(".bottom-nav")
          ? document.querySelector<HTMLElement>(".page-transition")
          : g
              .closest(".trend-swipe")
              ?.querySelector<HTMLElement>(".trend-stage");
        if (stage) stage.style.translate = dx * 0.12 + "px 0px";
        if (g.matches(".bottom-nav"))
          g.style.setProperty(
            "--tab",
            String(
              Math.max(
                0,
                Math.min(
                  buttons.length - 1,
                  (x / r.width) * buttons.length - 0.5,
                ),
              ),
            ),
          );
        else {
          const b = buttons[0];
          if (b) {
            g.style.setProperty(
              "--selected-x",
              Math.max(
                b.offsetLeft,
                Math.min(
                  r.width - b.offsetWidth - b.offsetLeft,
                  x - b.offsetWidth / 2,
                ),
              ) + "px",
            );
          }
        }
      });
    };
    const finish = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag;
      drag = undefined;
      if (frame) cancelAnimationFrame(frame);
      delete d.group.dataset.dragging;
      if (!d.active) return;
      const stage = d.group.matches(".bottom-nav")
        ? document.querySelector<HTMLElement>(".page-transition")
        : d.group
            .closest(".trend-swipe")
            ?.querySelector<HTMLElement>(".trend-stage");
      if (stage) {
        const previous = stage.style.translate;
        stage.style.translate = "";
        settling.get(stage)?.cancel();
        const animation = stage.animate(
          [{ translate: previous || "0px" }, { translate: "0px" }],
          { duration: 420, easing: "cubic-bezier(.22,.7,.2,1)" },
        );
        settling.set(stage, animation);
        animation.onfinish = () => {
          if (settling.get(stage) === animation) settling.delete(stage);
        };
      }
      const buttons = Array.from(
          d.group.querySelectorAll<HTMLButtonElement>(":scope > button"),
        ),
        r = d.group.getBoundingClientRect();
      const b = buttons.reduce<HTMLButtonElement | undefined>(
        (best, b) =>
          !best ||
          Math.abs(
            b.getBoundingClientRect().x + b.offsetWidth / 2 - e.clientX,
          ) <
            Math.abs(
              best.getBoundingClientRect().x + best.offsetWidth / 2 - e.clientX,
            )
            ? b
            : best,
        undefined,
      );
      if (e.type !== "pointercancel" && b && !b.disabled) {
        block = d.group;
        const previous = buttons.findIndex(
          (x) =>
            x.getAttribute("aria-current") === "page" ||
            x.getAttribute("aria-pressed") === "true",
        );
        document.documentElement.style.setProperty(
          "--slide-direction",
          String(buttons.indexOf(b) >= previous ? 1 : -1),
        );
        b.click();
        setTimeout(() => {
          block = undefined;
        }, 100);
      }
      const current = buttons.findIndex(
        (b) =>
          b.getAttribute("aria-current") === "page" ||
          b.getAttribute("aria-pressed") === "true",
      );
      if (d.group.matches(".bottom-nav"))
        d.group.style.setProperty("--tab", String(Math.max(0, current)));
      else if (buttons[current])
        d.group.style.setProperty(
          "--selected-x",
          buttons[current].offsetLeft + "px",
        );
    };

    const click = (e: MouseEvent) => {
      if (block && e.isTrusted && block.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const context = (e: Event) => {
      if (
        !(e.target as Element).closest("input,textarea,[contenteditable=true]")
      )
        e.preventDefault();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    document.addEventListener("click", click, true);
    document.addEventListener("contextmenu", context);
    return () => {
      settling.forEach((a) => a.cancel());
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      document.removeEventListener("click", click, true);
      document.removeEventListener("contextmenu", context);
    };
  }, []);
}
export function usePageSwipe(
  index: number,
  count: number,
  onChange: (i: number) => void,
) {
  const state = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (
        e.isPrimary &&
        e.clientX > 24 &&
        e.clientX < innerWidth - 24 &&
        !(e.target as Element).closest(
          "button,input,textarea,select,a,summary,.chart,.table-scroll,.photo-grid,.zoom-surface,dialog",
        )
      )
        state.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = state.current;
      state.current = null;
      if (!s) return;
      const dx = e.clientX - s.x,
        dy = e.clientY - s.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
        onChange(Math.max(0, Math.min(count - 1, index + (dx < 0 ? 1 : -1))));
    },
    onPointerCancel: () => {
      state.current = null;
    },
  };
}
