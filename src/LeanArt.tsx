/** Decorative line art only: never represents a measurement or a body prediction. */
type LeanArtProps = {
  className?: string;
  /** An override may be supplied by the surrounding light/dark theme. */
  accent?: string;
};

type BodyContourProps = LeanArtProps & {
  variant?: "torso" | "shoulder";
};

/** Gender-inclusive shoulder/torso gestures drawn in the surrounding text colour. */
export function BodyContour({
  className,
  variant = "torso",
  accent = "var(--lean-accent, #d67c48)",
}: BodyContourProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 300 420"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {variant === "torso" ? (
          <>
            <path d="M185 -12c-8 24-16 45-18 70-2 22-5 37-19 45-17 10-46 12-63 28-23 22-15 47-1 66 18 25 40 48 50 75 12 31 4 55-18 72-25 19-53 31-67 66" />
            <path d="M268 36c-15 11-23 26-28 41-5 14-7 26-16 28-15 4-34-12-48-5-22 11-36 40-45 62" />
            <path d="M248 110c16-12 33-16 42-2 12 18 8 48 12 69" />
            <path d="M246 142c-11 19-17 39-23 62-8 29-14 51-14 75" />
            <path
              d="M114 166c-1 35 10 65 24 94 16 33 28 62 23 91-4 23-15 43-28 64"
              opacity=".6"
            />
            <path d="M283 211c-6 22-22 40-30 60-11 27-15 54-21 78-6 25-11 48-7 75" />
            <path
              d="M211 111c-13 17-14 38-8 56m-43 27c28-10 48-25 68-48"
              opacity=".65"
            />
          </>
        ) : (
          <>
            <path d="M169 -9c-8 34-14 69-19 102-3 20-8 31-24 38-23 11-51 14-66 35-20 28-7 56 13 81 21 26 46 49 54 81 8 32-9 63-33 92" />
            <path d="M278 28c-15 27-18 52-32 67-13 13-35 11-53 16-26 7-37 28-45 50" />
            <path d="M191 112c27-9 53-5 68 14 18 23 22 55 28 87 8 44 14 84 26 120" />
            <path
              d="M145 153c-3 23 3 46 14 68 16 31 33 57 38 88 6 36-4 73-19 113"
              opacity=".65"
            />
            <path
              d="M248 150c-20 25-29 53-35 81m-41-45c21-8 40-21 56-36"
              opacity=".75"
            />
          </>
        )}
      </g>
      <g stroke={accent} strokeWidth="1.9" strokeLinecap="round">
        {variant === "torso" ? (
          <>
            <path d="M93 146c-2 25 8 47 26 66" />
            <path d="M106 226c18 23 46 29 53 55 5 16 1 33-8 49" />
            <path d="M265 194c-13 29-8 52-10 77-3 33-19 55-43 76-21 18-40 37-51 60" />
            <path d="M240 94c4-16 9-32 20-47" />
          </>
        ) : (
          <>
            <path d="M80 176c-4 23 5 44 20 63" />
            <path d="M195 115c21-7 40-4 52 7" />
            <path d="M245 189c-12 36-9 66-15 94-7 31-23 52-48 76" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Fine intertwined fibres for training surfaces. Styling/animation stays in CSS. */
export function MuscleFlow({
  className,
  accent = "var(--lean-accent, #d67c48)",
}: LeanArtProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 440 280"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke={accent} strokeWidth=".8" strokeLinecap="round">
        <path d="M61 289C106 219 119 153 216 133S352 80 365-12" opacity=".22" />
        <path d="M79 291C134 213 121 171 220 143S351 63 383-10" opacity=".45" />
        <path d="M97 291C147 215 137 174 232 144S361 65 399-8" opacity=".3" />
        <path d="M113 291C164 215 141 189 241 148S356 76 415-9" opacity=".7" />
        <path d="M128 291C181 221 165 178 253 145S366 76 431-7" opacity=".4" />
        <path
          d="M24 275C110 252 146 202 201 171S325 103 336-11"
          opacity=".25"
        />
        <path d="M39 284C121 251 135 209 213 173S333 104 349-12" opacity=".5" />
        <path d="M21 248C120 221 151 192 211 161S313 98 321-9" opacity=".65" />
        <path d="M33 231C111 206 145 180 211 151S303 88 307-8" opacity=".3" />
        <path d="M58 211C126 191 159 169 223 145S292 78 294-9" opacity=".4" />
        <path d="M147 292C202 210 175 170 271 137S385 57 447 5" opacity=".3" />
        <path d="M171 291C220 211 193 162 283 132S398 54 450 28" opacity=".6" />
      </g>
    </svg>
  );
}
