import { useEffect, useId, useState } from "react";
import type { TrainingEntry } from "./data";
import { emptyData, localDate, type Snapshot } from "./records";
import { useMuscle } from "./Onboarding";
import { Modal } from "./Modal";
import { trainingStreak } from "./training-streak";
import { ShareStudio, SharePreview } from "./ShareStudio";
import { Disclosure } from "./FoldSection";
import { useHasViewState, useViewState } from "./view-state";
import {
  defaultOptions,
  type ShareOptions,
  type ShareCardSnapshot,
} from "./share-model";
export { trainingStreak } from "./training-streak";

export function Achievement({
  training,
  data,
  today = localDate(),
  onRecord,
  onActiveChange,
  compact = false,
}: {
  training: TrainingEntry[];
  data?: Snapshot;
  today?: string;
  onRecord?: () => void;
  onActiveChange?: (active: boolean) => void;
  compact?: boolean;
}) {
  const muscle = useMuscle(),
    id = useId(),
    s = trainingStreak(training, today);
  const [owner] = useState(() => id + ":" + crypto.randomUUID());
  const [screen, setScreen] = useState<"degree" | "share" | "preview" | null>(
    null,
  );
  const [frozen, setFrozen] = useState<ShareCardSnapshot | null>(null);
  const remembered = useHasViewState("share-card-options");
  const [options, setOptions] = useViewState<ShareOptions>(
    "share-card-options",
    () =>
      !remembered && data?.profile?.style === "lean"
        ? { ...defaultOptions, template: "lean-lines" }
        : defaultOptions,
  );
  const currentData = data ?? { ...emptyData, training };
  const resting = training.some((r) => r.date === today && r.status === "rest");
  useEffect(() => {
    const pop = () =>
      setScreen(
        history.state?.dailyDegree === owner ? history.state.view : null,
      );
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, [owner]);
  useEffect(() => {
    document
      .querySelector<HTMLElement>(".degree-modal > .modal-content")
      ?.scrollTo?.({ top: 0 });
  }, [screen]);
  useEffect(() => {
    onActiveChange?.(!!screen);
    return () => onActiveChange?.(false);
  }, [screen, onActiveChange]);
  function go(view: "degree" | "share" | "preview") {
    history.pushState(
      {
        ...history.state,
        dailyDegree: owner,
        view,
        depth:
          history.state?.dailyDegree === owner
            ? (history.state.depth || 0) + 1
            : 1,
      },
      "",
    );
    setScreen(view);
  }
  function close() {
    if (history.state?.dailyDegree === owner)
      history.go(-(history.state.depth || 1));
    setScreen(null);
  }
  function record() {
    close();
    onRecord?.();
  }
  return (
    <>
      <button
        data-degree-entry="true"
        className={
          compact
            ? "panel full-button quote-entry degree-entry"
            : "panel full-button quote-entry"
        }
        onClick={() => go("degree")}
      >
        <span className="entry-copy">
          <strong className="entry-title">
            {compact ? `我的${muscle}学位` : `${muscle}学士学位考核`}
          </strong>
          {data?.profile?.style === "lean" && (
            <span className="lean-degree-count">
              {s.current}
              <small> / 100 天</small>
            </span>
          )}
          <small className="entry-note">
            当前 {s.current} 天 · 历史最长 {s.best} 天
          </small>
        </span>
        <span className="entry-side">
          {s.passed ? "历史已达标" : "查看进度"} ›
        </span>
      </button>
      {screen && (
        <Modal
          title={
            screen === "degree"
              ? `我的${muscle}学位`
              : screen === "share"
                ? "制作分享卡"
                : "预览卡片"
          }
          className="degree-modal settings-modal"
          onClose={close}
        >
          {screen === "degree" ? (
            <div className="degree-overview">
              <span className="degree-eyebrow">LEAN / 100 DAYS</span>
              <h3>
                {s.passed
                  ? "你曾经，连续坚持了100天。"
                  : s.best
                    ? "学位修读中，生活继续。"
                    : "从今天开始记录"}
              </h3>
              <p className="degree-number">
                {s.current}
                <small> / 100 天</small>
              </p>
              <p>当前连续训练</p>
              <progress
                aria-label="当前连续训练进度"
                max={100}
                value={Math.min(s.current, 100)}
              />
              <div className="degree-facts">
                <span>
                  历史最长<strong>{s.best} 天</strong>
                </span>
                <span>
                  历史达标<strong>{s.passed ? "已达标" : "未达标"}</strong>
                </span>
              </div>
              {resting && (
                <p className="degree-rest">
                  今天已记为休息。好好休息，也在向前。
                </p>
              )}
              <div className="share-actions">
                <button className="primary" onClick={() => go("share")}>
                  制作分享卡
                </button>
                {onRecord && (
                  <button className="small-button" onClick={record}>
                    记录今天
                  </button>
                )}
                {s.passed && (
                  <button
                    className="small-button"
                    onClick={() => {
                      setOptions((o) => ({ ...o, kind: "graduation" }));
                      go("share");
                    }}
                  >
                    毕业纪念卡
                  </button>
                )}
              </div>
              <Disclosure className="degree-rules" memoryKey="degree.rules">
                <summary>查看规则 · 连续100天</summary>
                <p>
                  连续100天记录实际训练；休息或漏记会中断。今天结束前不会提前判定漏打，修改历史记录后重新计算。未来记录不计入，每天最多计一次。
                </p>
                <p>
                  历史最长达到100天即可生成毕业纪念。当前连续与历史达标分别统计；纪念卡基于现有记录，不是永久授予的证书。
                </p>
              </Disclosure>
              <p className="hint">娱乐成就，非真实学历。统计截至 {today}。</p>
            </div>
          ) : screen === "preview" && frozen ? (
            <SharePreview
              snapshot={frozen}
              data={currentData}
              today={today}
              options={options}
              onBack={() => history.back()}
            />
          ) : (
            <ShareStudio
              data={currentData}
              today={today}
              options={options}
              setOptions={setOptions}
              onBack={() => history.back()}
              onRecord={onRecord ? record : undefined}
              onPreview={(snapshot) => {
                setFrozen(snapshot);
                go("preview");
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
