export function reducedMotion() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export const motion = { close: 550, enter: 800 };
let depth = 0;
export function freezeBackground() {
  const root = document.documentElement;
  if (depth++ === 0) {
    const nav = document.querySelector(".bottom-nav");
    root.style.setProperty(
      "--frozen-nav-top",
      (nav?.getBoundingClientRect().top ?? innerHeight - 80) + "px",
    );
    root.dataset.modalOpen = "true";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--depth === 0) {
      delete root.dataset.modalOpen;
      root.style.removeProperty("--frozen-nav-top");
    }
  };
}
export function safeViewport(
  width: number,
  height: number,
  top: number,
  bottom: number,
  left = 0,
  right = 0,
) {
  const inset = 12;
  return {
    width: Math.max(0, width - left - right - inset * 2),
    height: Math.max(0, height - top - bottom - inset * 2),
    x: left + inset,
    y: top + inset,
  };
}
