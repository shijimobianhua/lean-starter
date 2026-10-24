import { useEffect } from "react";
export function useAppInteraction() {
  useEffect(() => {
    const root = document.documentElement;
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    root.dataset.platform = ios ? "ios" : "other";
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone;
    root.dataset.standalone = String(standalone);
    root.dataset.input = "pointer";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key.startsWith("Arrow"))
        root.dataset.input = "keyboard";
    };
    const pointer = (e: PointerEvent) => {
      root.dataset.input = "pointer";
      const target = (e.target as Element).closest("button");
      if (target) requestAnimationFrame(() => target.blur());
    };
    const gesture = (e: Event) => e.preventDefault();
    const touch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    let frame = 0;
    const update = () => {
      frame = 0;
      const v = window.visualViewport;
      const keyboard=!!root.dataset.modalOpen && !!document.activeElement?.matches("input,textarea") && (v?.height??innerHeight)<innerHeight*.8;
      root.dataset.keyboard=String(keyboard);
      root.style.setProperty(
        "--visual-height",
        (v?.height ?? innerHeight) + "px",
      );
      root.style.setProperty("--visual-width", (v?.width ?? innerWidth) + "px");
      root.style.setProperty("--visual-top", (v?.offsetTop ?? 0) + "px");
      // Background navigation keeps its position while an editor or keyboard is open.
      if (
        !root.dataset.modalOpen &&
        !document.activeElement?.matches("input,textarea,select")
      ) {
        root.style.setProperty(
          "--nav-viewport-height",
          (v?.height ?? innerHeight) + "px",
        );
        root.style.setProperty(
          "--nav-viewport-top",
          (v?.offsetTop ?? 0) + "px",
        );
      }
    };
    const resize = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    let selectedFrame = 0;
    const placeSelected = () => {
      selectedFrame = 0;
      document
        .querySelectorAll<HTMLElement>(".segments,.range-pills,.theme-options")
        .forEach((group) => {
          const button = group.querySelector<HTMLElement>(
            ':scope > button[aria-pressed="true"]',
          );
          if (!button) {
            delete group.dataset.sliding;
            return;
          }
          group.dataset.sliding = "true";
          group.style.setProperty("--selected-x", button.offsetLeft + "px");
          group.style.setProperty("--selected-y", button.offsetTop + "px");
          group.style.setProperty("--selected-w", button.offsetWidth + "px");
          group.style.setProperty("--selected-h", button.offsetHeight + "px");
        });
    };
    const selectedChange = () => {
      if (!selectedFrame) selectedFrame = requestAnimationFrame(placeSelected);
    };
    const observer = new MutationObserver(selectedChange);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
    selectedChange();
    window.addEventListener("resize", selectedChange);

    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("gesturestart", gesture, { passive: false });
    document.addEventListener("gesturechange", gesture, { passive: false });
    document.addEventListener("touchmove", touch, { passive: false });
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    document.addEventListener("focusout", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", selectedChange);
      if (selectedFrame) cancelAnimationFrame(selectedFrame);
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("gesturestart", gesture);
      document.removeEventListener("gesturechange", gesture);
      document.removeEventListener("touchmove", touch);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      document.removeEventListener("focusout", resize);
    };
  }, []);
}
