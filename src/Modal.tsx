import { freezeBackground, motion, reducedMotion } from "./viewport";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
export function useModal(
  onExit: () => void,
  canClose: () => boolean | Promise<boolean> = () => true,
) {
  const ref = useRef<HTMLDialogElement>(null),
    exit = useRef(onExit),
    guard = useRef(canClose),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    closingRef = useRef(false),
    checking = useRef(false),
    [closing, setClosing] = useState(false),
    outside = useRef(false);
  exit.current = onExit;
  guard.current = canClose;
  async function dismiss(force = false) {
    if (closingRef.current || checking.current) return;
    if (!force) {
      checking.current = true;
      let allowed = false;
      try {
        allowed = await guard.current();
      } finally {
        checking.current = false;
      }
      if (!allowed) return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const duration = reducedMotion() ? 0 : motion.close;
    timer.current = setTimeout(() => exit.current(), duration);
  }
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement as HTMLElement | null,
      scrollY = window.scrollY;
    const releaseBackground = freezeBackground();
    const body = document.body;
    const previousStyle = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = -scrollY + "px";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (dialog && !dialog.open) {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    let stable: { height: number; width: number; center: number } | undefined;
    let baseline = window.visualViewport?.height ?? innerHeight;
    let keyboardFrame = 0,
      focusFrame = 0;
    let morph: Animation | undefined,
      lastHeight = dialog?.offsetHeight ?? 0;
    const focus = () => {
      if (
        !dialog ||
        !dialog.contains(document.activeElement) ||
        !document.activeElement?.matches("input,textarea")
      )
        return;
      if (!stable) {
        const r = dialog.getBoundingClientRect();
        stable = {
          height: dialog.offsetHeight,
          width: dialog.offsetWidth,
          center:
            parseFloat(getComputedStyle(dialog).top) || r.top + r.height / 2,
        };
        baseline = Math.max(baseline, innerHeight);
        dialog.style.setProperty("--stable-height", stable.height + "px");
        dialog.style.setProperty("--stable-center", stable.center + "px");
        dialog.dataset.layoutFrozen = "true";
      }
    };
    const keyboard = () => {
      if (!dialog) return;
      const vv = window.visualViewport,
        visible = vv?.height ?? innerHeight;
      const active =
        dialog.contains(document.activeElement) &&
        !!document.activeElement?.matches("input,textarea");
      if (active && visible < baseline * 0.8 && stable) {
        const safe =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--safe-top",
            ),
          ) || 0;
        const lift = Math.min(
          16,
          Math.max(0, stable.center - stable.height / 2 - safe - 12),
        );
        dialog.style.setProperty("--stable-height", stable.height + "px");
        dialog.style.setProperty("--stable-width", stable.width + "px");
        dialog.style.setProperty(
          "--stable-center",
          Math.max(safe + 12 + stable.height / 2, stable.center - lift) + "px",
        );
        dialog.dataset.keyboard = "true";
        dialog.style.setProperty(
          "--keyboard-overlap",
          Math.max(
            0,
            stable.center -
              lift +
              stable.height / 2 -
              ((vv?.offsetTop ?? 0) + visible) +
              24,
          ) + "px",
        );
        cancelAnimationFrame(keyboardFrame);
        keyboardFrame = requestAnimationFrame(() => {
          if (!dialog.isConnected) return;
          const target = document.activeElement as HTMLElement;
          const r = target?.getBoundingClientRect();
          if (r && r.bottom > (vv?.offsetTop ?? 0) + visible - 16)
            (
              dialog.querySelector<HTMLElement>(".modal-content") ?? dialog
            ).scrollTop += r.bottom - ((vv?.offsetTop ?? 0) + visible) + 24;
        });
      } else if (visible >= baseline * 0.9) {
        delete dialog.dataset.keyboard;
        dialog.style.removeProperty("--keyboard-overlap");
        if (!active) {
          stable = undefined;
          delete dialog.dataset.layoutFrozen;
        }
        cancelAnimationFrame(focusFrame);
        focusFrame = requestAnimationFrame(focus);
        lastHeight = dialog.getBoundingClientRect().height;
      }
    };
    // Observe intrinsic content, never the animated dialog itself. One bounded animation per dialog.
    let frame = 0;
    const resize = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (
          !dialog ||
          dialog.dataset.keyboard ||
          dialog.dataset.layoutFrozen ||
          dialog.matches(".wide-viewer,.exercise-picker,.settings-modal") ||
          dialog.querySelector(".disclosure")
        )
          return;
        if (
          dialog
            .getAnimations()
            .some((a) => a !== morph && a.playState === "running")
        )
          return;
        const current =
          morph?.playState === "running"
            ? dialog.getBoundingClientRect().height
            : lastHeight;
        morph?.cancel();
        morph = undefined;
        const next = dialog.offsetHeight;
        if (Math.abs(next - current) > 3)
          morph = dialog.animate(
            [{ height: current + "px" }, { height: next + "px" }],
            { duration: 420, easing: "cubic-bezier(.22,.7,.2,1)" },
          );
        lastHeight = next;
      });
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : undefined;
    if (dialog) for (const child of dialog.children) observer?.observe(child);
    dialog?.addEventListener("focusin", focus);
    window.visualViewport?.addEventListener("resize", keyboard);
    window.visualViewport?.addEventListener("scroll", keyboard);
    const unfocus = () => {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        if (
          dialog &&
          (!dialog.contains(document.activeElement) ||
            !document.activeElement?.matches("input,textarea")) &&
          !dialog.dataset.keyboard
        ) {
          delete dialog.dataset.layoutFrozen;
          stable = undefined;
        }
      });
    };
    dialog?.addEventListener("focusout", unfocus);
    focus();
    return () => {
      dialog?.removeEventListener("focusout", unfocus);
      observer?.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(keyboardFrame);
      cancelAnimationFrame(focusFrame);
      morph?.cancel();
      dialog?.removeEventListener("focusin", focus);
      window.visualViewport?.removeEventListener("resize", keyboard);
      window.visualViewport?.removeEventListener("scroll", keyboard);
      if (timer.current) clearTimeout(timer.current);
      dialog?.close?.();
      Object.assign(body.style, previousStyle);
      if (scrollY) window.scrollTo(0, scrollY);
      releaseBackground();
      if (previous?.isConnected) {
        previous.focus({ preventScroll: true });
        if (document.documentElement.dataset.input !== "keyboard")
          previous.blur();
      }
    };
  }, []);
  const isOutside = (e: PointerEvent<HTMLDialogElement>) => {
    if (e.target !== e.currentTarget) return false;
    const r = e.currentTarget.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  };
  return {
    ref,
    closing,
    dismiss,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLDialogElement>) => {
        outside.current = isOutside(e);
      },
      onPointerUp: (e: PointerEvent<HTMLDialogElement>) => {
        if (outside.current && isOutside(e)) dismiss();
        outside.current = false;
      },
      onCancel: (e: React.SyntheticEvent) => {
        e.preventDefault();
        dismiss();
      },
    },
  };
}
export function Modal({
  title,
  onClose,
  children,
  className = "",
  canClose,
  closeRequested = false,
  closeLabel = "关闭浮窗",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  canClose?: () => boolean | Promise<boolean>;
  closeRequested?: boolean;
  closeLabel?: string;
}) {
  const modal = useModal(onClose, canClose);
  useEffect(() => {
    if (closeRequested) void modal.dismiss(true);
  }, [closeRequested]);
  return (
    <dialog
      ref={modal.ref}
      {...modal.handlers}
      className={
        "app-modal " + className + (modal.closing ? " is-closing" : "")
      }
      aria-label={title}
      aria-modal="true"
    >
      <div className="modal-content">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={() => modal.dismiss()}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
