import { BodyContour } from "./LeanArt";
import {
  readWelcomeDraft,
  saveWelcomeDraft,
  clearWelcomeDraft,
  type UiStyle,
} from "./ui-style";
import { reducedMotion } from "./viewport";
import { BackupPanel } from "./BackupPanel";
import { Modal } from "./Modal";
import { createContext, useContext, useState, useRef, useEffect } from "react";
import { db, type Profile } from "./data";
import type { Run } from "./RecordForms";
const MuscleContext = createContext("薄肌");
export function MuscleProvider({
  gender,
  children,
}: {
  gender?: string;
  children: React.ReactNode;
}) {
  return (
    <MuscleContext.Provider value={gender === "female" ? "马甲线" : "薄肌"}>
      {children}
    </MuscleContext.Provider>
  );
}
export const useMuscle = () => useContext(MuscleContext);
export function MuscleText() {
  return <>{useMuscle()}</>;
}
export async function saveGender(
  gender: "male" | "female",
  done?: boolean,
  style?: UiStyle,
) {
  await db.transaction("rw", db.profile, async () => {
    const p = await db.profile.get("local");
    await db.profile.put({
      ...p,
      id: "local",
      gender,
      ...(done ? { onboardingDone: true } : {}),
      ...(style ? { style } : {}),
    });
  });
}
export function GenderSettings({
  profile,
  run,
}: {
  profile?: Profile;
  run: Run;
}) {
  return (
    <section className="panel">
      <h2>性别</h2>
      <div className="segments">
        {(["male", "female"] as const).map((g) => (
          <button
            key={g}
            aria-pressed={profile?.gender === g}
            onClick={() => void run(() => saveGender(g), "已更新")}
          >
            {g === "male" ? "男" : "女"}
          </button>
        ))}
      </div>
    </section>
  );
}
export function Onboarding({ profile }: { profile?: Profile }) {
  const [draft] = useState(readWelcomeDraft);
  const [style, setStyle] = useState<UiStyle>(draft.style);
  const [step, setStep] = useState(draft.step),
    [gender, setGender] = useState<"male" | "female" | undefined>(
      draft.gender ?? profile?.gender,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [restoring, setRestoring] = useState(false),
    [restoreMessage, setRestoreMessage] = useState("");
  const restoreRun: Run = async (action, message) => {
    try {
      await action();
      setRestoreMessage(message);
      return true;
    } catch (e) {
      setRestoreMessage(e instanceof Error ? e.message : "恢复失败，请重试");
      return false;
    }
  };
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!transition.current) saveWelcomeDraft({ step, gender, style });
    document.documentElement.dataset.style = style;
  }, [step, gender, style]);
  const transition = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const advance = (next: number, nextStyle = style) => {
    if (transition.current) return;
    transition.current = true;
    saveWelcomeDraft({ step: next, gender, style: nextStyle });
    setLeaving(true);
    timer.current = setTimeout(
      () => {
        setStep(next);
        setLeaving(false);
        transition.current = false;
      },
      reducedMotion() ? 0 : 260,
    );
  };
  return (
    <div
      className="onboarding"
      role="dialog"
      aria-modal="true"
      aria-label="欢迎使用 薄肌 LEAN"
    >
      <div
        className={"onboarding-stage" + (leaving ? " leaving" : "")}
        key={step}
        data-step={step}
      >
        <span className="onboarding-brand">薄肌 LEAN</span>
        {step === -1 ? (
          <>
            <BodyContour className="journey-contour" />
            <span className="journey-eyebrow">YOUR BODY · YOUR PACE</span>
            <h1>
              是否开始
              <br />
              薄肌之旅
            </h1>
            <p className="journey-note">从今天起，留下身体与生活的变化。</p>
            <div className="journey-choices">
              <button
                aria-pressed={style === "lean"}
                onClick={() => {
                  if (transition.current) return;
                  setStyle("lean");
                  advance(0, "lean");
                }}
              >
                <strong>开始薄肌之旅</strong>
                <small>以薄肌风格开启记录</small>
                <span aria-hidden="true">↗</span>
              </button>
              <button
                aria-pressed={style === "default"}
                onClick={() => {
                  if (transition.current) return;
                  setStyle("default");
                  advance(0, "default");
                }}
              >
                <strong>普通使用版</strong>
                <small>使用默认风格记录日常</small>
                <span aria-hidden="true">→</span>
              </button>
            </div>
            <button className="text-button" onClick={() => setRestoring(true)}>
              从备份恢复
            </button>
          </>
        ) : step === 0 ? (
          <>
            <h1>从你开始</h1>
            <button
              className="text-button welcome-back"
              onClick={() => advance(-1)}
            >
              返回选择使用方式
            </button>
            <div className="gender-choices">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  aria-pressed={gender === g}
                  onClick={() => setGender(g)}
                >
                  {g === "male" ? "男" : "女"}
                  <small>{g === "male" ? "薄肌" : "马甲线"}</small>
                </button>
              ))}
            </div>
            <button
              className="primary"
              disabled={!gender}
              onClick={() => advance(1)}
            >
              继续
            </button>
            <button className="text-button" onClick={() => setRestoring(true)}>
              从备份恢复
            </button>
          </>
        ) : step === 1 ? (
          <>
            <h1>让日常，随身</h1>
            <div className="install-guide">
              <h2>iPhone</h2>
              <p>Safari → 分享 → 添加到主屏幕</p>
              <h2>安卓</h2>
              <p>浏览器菜单 → 安装应用或添加到主屏幕</p>
              <p className="hint">
                首次联网完成缓存后可离线使用。记录仅存本机，请定期备份。
              </p>
            </div>
            <button className="primary" onClick={() => advance(2)}>
              继续
            </button>
            <button className="text-button" onClick={() => advance(0)}>
              返回
            </button>
          </>
        ) : (
          <>
            <h1 className="manifesto">重仓自己的身体</h1>
            <div className="manifesto-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (!gender) return;
                  setBusy(true);
                  try {
                    setLeaving(true);
                    await new Promise((resolve) =>
                      setTimeout(resolve, reducedMotion() ? 0 : 260),
                    );
                    await saveGender(gender, true, style);
                    try {
                      localStorage.setItem("form-style", style);
                    } catch {}
                    clearWelcomeDraft();
                  } catch {
                    setLeaving(false);
                    setError("无法保存，请重试");
                    setBusy(false);
                  }
                }}
              >
                {busy ? "正在开始…" : "开始记录"}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => advance(1)}
              >
                返回
              </button>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {restoring && (
          <Modal title="恢复已有记录" onClose={() => setRestoring(false)}>
            <BackupPanel run={restoreRun} />
            {restoreMessage && <p role="status">{restoreMessage}</p>}
          </Modal>
        )}
      </div>
    </div>
  );
}
