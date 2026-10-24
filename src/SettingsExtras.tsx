import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { updateProfile } from "./units";
import { BodyContour } from "./LeanArt";
export const styleRegistry = [
  { id: "default" as const, name: "默认风格", note: "清晰、平静，记录日常" },
  { id: "lean" as const, name: "薄肌风格", note: "身体线条与运动编辑设计" },
];
export function SettingsExtras({
  style = "default",
  onActiveChange,
}: {
  style?: "default" | "lean";
  onActiveChange?: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="panel settings-entry style-entry"
        onClick={() => setOpen(true)}
      >
        <span>风格选择</span>
        <span>{style === "lean" ? "薄肌风格" : "默认风格"} ›</span>
      </button>
      {open && (
        <StylePicker
          style={style}
          onClose={() => setOpen(false)}
          onActiveChange={onActiveChange}
        />
      )}
    </>
  );
}
function StylePicker({
  style,
  onClose,
  onActiveChange,
}: {
  style: "default" | "lean";
  onClose: () => void;
  onActiveChange?: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState(style),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState("");
  const committed = useRef(style);
  useEffect(() => {
    onActiveChange?.(true);
    return () => {
      document.documentElement.dataset.style = committed.current;
      onActiveChange?.(false);
    };
  }, [onActiveChange]);
  useEffect(() => {
    document.documentElement.dataset.style = draft;
  }, [draft]);
  return (
    <Modal
      title="风格选择"
      className="settings-modal style-modal"
      onClose={onClose}
      closeRequested={done}
      canClose={() => !busy}
    >
      <p className="hint">
        选择后可预览，点击“使用此风格”保存。所有记录保持不变。
      </p>
      <div className="style-preview-grid">
        {styleRegistry.map((s) => (
          <button
            key={s.id}
            className={"style-preview-choice " + s.id}
            aria-pressed={draft === s.id}
            onClick={() => setDraft(s.id)}
            disabled={busy}
          >
            <span className="style-miniature" aria-hidden="true">
              <span className="mini-brand">Lean</span>
              {s.id === "lean" && <BodyContour />}
              <span className="mini-hero" />
              <span className="mini-row">
                <i />
                <i />
              </span>
              <span className="mini-line" />
            </span>
            <span className="style-preview-title">
              {s.name}
              <span>{draft === s.id ? "✓" : ""}</span>
            </span>
            <small>{s.note}</small>
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await updateProfile({ style: draft });
            committed.current = draft;
            try {
              localStorage.setItem("form-style", draft);
            } catch {}
            setDone(true);
          } catch {
            setError("风格保存失败，请重试；预览仍保留。");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在保存…" : "使用此风格"}
      </button>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => setDone(true)}
      >
        取消
      </button>
    </Modal>
  );
}
