import { useEffect, useId, useRef, useState } from "react";
import { reducedMotion } from "./viewport";

export function ProgressGauge({ ratio }: { ratio: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, ""),
    gradient = `lean-progress-${uid}`,
    glow = `lean-glow-${uid}`,
    wash = `lean-wash-${uid}`;
  const [shown, setShown] = useState(ratio),
    current = useRef(ratio);
  useEffect(() => {
    if (reducedMotion()) {
      current.current = ratio;
      setShown(ratio);
      return;
    }
    const start = current.current,
      time = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - time) / 750),
        value = start + (ratio - start) * (1 - (1 - t) ** 3);
      current.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [ratio]);
  const x = 120 - 100 * Math.cos(Math.PI * shown),
    y = 120 - 100 * Math.sin(Math.PI * shown);
  return (
    <svg
      viewBox="0 0 240 145"
      aria-hidden="true"
      className="lean-gauge"
      data-progress={Math.round(ratio * 100)}
    >
      <defs>
        <linearGradient
          id={gradient}
          x1="20"
          y1="120"
          x2="220"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--gauge-from)" />
          <stop offset="1" stopColor="var(--gauge-to)" />
        </linearGradient>
        <linearGradient
          id={wash}
          x1="0"
          y1="20"
          x2="0"
          y2="120"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--gauge-wash)" />
          <stop offset="1" stopColor="var(--surface)" stopOpacity="0" />
        </linearGradient>
        <filter id={glow} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path
        d="M30 120 A90 90 0 0 1 210 120 Z"
        className="gauge-wash"
        style={{ fill: `url(#${wash})`, stroke: "none" }}
      />
      <path
        d="M20 120 A100 100 0 0 1 220 120"
        pathLength="100"
        className="gauge-track"
      />
      <path
        d="M20 120 A100 100 0 0 1 220 120"
        pathLength="100"
        className="gauge-value"
        style={{ stroke: `url(#${gradient})` }}
        strokeDasharray={`${shown * 100} 101`}
      />
      {shown > 0 && (
        <g className="gauge-end">
          <circle
            cx={x}
            cy={y}
            r="10"
            fill="var(--gauge-to)"
            opacity=".22"
            filter={`url(#${glow})`}
          />
          <circle cx={x} cy={y} r="8" fill="var(--surface)" />
          <circle cx={x} cy={y} r="5.5" fill="var(--gauge-to)" />
        </g>
      )}
    </svg>
  );
}
