import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Snapshot } from "./records";
import {
  contents,
  templates,
  phrases,
  metricLabels,
  todayMetrics,
  createShareSnapshot,
  clipNickname,
  clipVisible,
  visibleCharacters,
  normalizePhrase,
  type ShareOptions,
  type ContentKind,
  type TemplateId,
  type MetricKey,
  type ShareCardSnapshot,
} from "./share-model";
import { trainingStreak } from "./training-streak";
import { renderShareCard } from "./share-renderer";
import { PRODUCT_URL } from "./share-config";

interface EditorProps {
  data: Snapshot;
  today: string;
  options: ShareOptions;
  setOptions: Dispatch<SetStateAction<ShareOptions>>;
  onBack: () => void;
  onRecord?: () => void;
  onPreview: (snapshot: ShareCardSnapshot) => void;
}
export function ShareStudio({
  data,
  today,
  options: o,
  setOptions,
  onBack,
  onRecord,
  onPreview,
}: EditorProps) {
  const available = todayMetrics(data, today),
    streak = trainingStreak(data.training, today);
  const hasToday = Object.values(available).some(Boolean);
  const [error, setError] = useState(""),
    [limitNotice, setLimitNotice] = useState("");
  const composing = useRef(false),
    nickComposing = useRef(false);
  function set<K extends keyof ShareOptions>(key: K, value: ShareOptions[K]) {
    setError("");
    setOptions((p) => ({ ...p, [key]: value }));
  }
  function updatePhrase(value: string) {
    const count = visibleCharacters(value).length;
    setLimitNotice(count > 30 ? "最多30个可见字符，超出部分未保留。" : "");
    set("customPhrase", clipVisible(value, 30));
  }
  function preview() {
    try {
      onPreview(createShareSnapshot(data, o, today));
    } catch (e) {
      setError(e instanceof Error ? e.message : "请检查显示内容后重试。");
    }
  }
  return (
    <div className="share-studio">
      <button className="text-button share-back" onClick={onBack}>
        ‹ 返回学位页
      </button>
      <p className="hint share-intro">先选内容与样式，再预览你的卡片。</p>
      <section className="share-section" aria-labelledby="share-content-title">
        <h3 id="share-content-title">
          <span>01</span> 分享什么
        </h3>
        <div className="share-choice-grid">
          {(Object.entries(contents) as [ContentKind, string][]).map(
            ([kind, label]) => {
              const locked =
                (kind === "graduation" && !streak.passed) ||
                (kind === "today" && !hasToday);
              return (
                <button
                  key={kind}
                  className="share-content-choice"
                  aria-pressed={o.kind === kind}
                  disabled={locked}
                  onClick={() => set("kind", kind)}
                >
                  <span className="choice-title">
                    {label}
                    <span className="choice-check" aria-hidden="true">
                      {o.kind === kind ? "✓" : ""}
                    </span>
                  </span>
                  <small>
                    {kind === "graduation" && !streak.passed
                      ? "历史最长需满100天"
                      : kind === "today" && !hasToday
                        ? "今天暂无记录"
                        : kind === "enrollment"
                          ? "从参与开始"
                          : kind === "today"
                            ? "只分享已有记录"
                            : kind === "progress"
                              ? "当前与历史分别展示"
                              : "历史已达标"}
                  </small>
                </button>
              );
            },
          )}
        </div>
        {!hasToday && onRecord && (
          <button
            className="small-button share-record-first"
            onClick={onRecord}
          >
            先记录今天 <span aria-hidden="true">›</span>
          </button>
        )}
      </section>
      <section className="share-section" aria-labelledby="share-style-title">
        <h3 id="share-style-title">
          <span>02</span> 选择样式
        </h3>
        <div className="share-template-grid">
          {(Object.entries(templates) as [TemplateId, string][]).map(
            ([id, name]) => (
              <button
                key={id}
                className={`share-template ${id}`}
                aria-pressed={o.template === id}
                onClick={() => set("template", id)}
              >
                <span className="template-sample" aria-hidden="true">
                  {id === "minimal-degree"
                    ? "Lean /"
                    : id === "absurd-note"
                      ? "( •_• )"
                      : id === "lean-lines" ? "Lean /" : "ARCHIVE"}
                </span>
                <span>{name}</span>
                <span className="template-check" aria-hidden="true">
                  {o.template === id ? "✓" : ""}
                </span>
              </button>
            ),
          )}
        </div>
      </section>
      <section className="share-section" aria-labelledby="share-display-title">
        <h3 id="share-display-title">
          <span>03</span> 显示内容
        </h3>
        <label className="share-check">
          <input
            type="checkbox"
            checked={o.showNickname}
            onChange={(e) => set("showNickname", e.target.checked)}
          />
          显示昵称（可选）
        </label>
        {o.showNickname && (
          <label className="share-input-label">
            昵称 · 最多12个可见字符
            <input
              aria-label="分享昵称"
              placeholder="LEAN学员"
              value={o.nickname}
              onCompositionStart={() => {
                nickComposing.current = true;
              }}
              onCompositionEnd={(e) => {
                nickComposing.current = false;
                set("nickname", clipNickname(e.currentTarget.value));
              }}
              onChange={(e) =>
                set(
                  "nickname",
                  nickComposing.current
                    ? e.target.value
                    : clipNickname(e.target.value),
                )
              }
            />
          </label>
        )}
        {o.kind === "today" && (
          <div className="share-metrics">
            {(Object.keys(metricLabels) as MetricKey[]).map((k) => (
              <div key={k}>
                <label className="share-check">
                  <input
                    type="checkbox"
                    checked={!!available[k] && o.selected[k]}
                    disabled={!available[k]}
                    onChange={(e) =>
                      setOptions((p) => ({
                        ...p,
                        selected: { ...p.selected, [k]: e.target.checked },
                      }))
                    }
                  />
                  {metricLabels[k]}
                  <small>{available[k]?.status ?? "无记录"}</small>
                </label>
                {k !== "training" && available[k] && o.selected[k] && (
                  <label className="share-check share-exact">
                    <input
                      type="checkbox"
                      checked={o.exact[k]}
                      onChange={(e) =>
                        setOptions((p) => ({
                          ...p,
                          exact: { ...p.exact, [k]: e.target.checked },
                        }))
                      }
                    />
                    显示{metricLabels[k]}数值
                  </label>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="hint">
          昵称与身体数值默认隐藏。照片、BMI和三围不进入卡片。
        </p>
      </section>
      <section className="share-section" aria-labelledby="share-phrase-title">
        <h3 id="share-phrase-title">
          <span>04</span> 卡片短句
        </h3>
        <div className="segments" aria-label="短句来源">
          <button
            aria-pressed={o.phraseMode !== "custom"}
            onClick={() => set("phraseMode", "preset")}
          >
            预设短句
          </button>
          <button
            aria-pressed={o.phraseMode === "custom"}
            onClick={() => set("phraseMode", "custom")}
          >
            自己写一句
          </button>
        </div>
        {o.phraseMode === "custom" ? (
          <>
            <label className="share-input-label">
              自定义短句
              <textarea
                aria-label="自定义短句"
                rows={3}
                placeholder="用一句话，记下今天的自己"
                value={o.customPhrase ?? ""}
                onCompositionStart={() => {
                  composing.current = true;
                }}
                onCompositionEnd={(e) => {
                  composing.current = false;
                  updatePhrase(e.currentTarget.value);
                }}
                onChange={(e) =>
                  composing.current
                    ? set("customPhrase", e.target.value)
                    : updatePhrase(e.target.value)
                }
              />
            </label>
            <p className="phrase-counter" aria-live="polite">
              {visibleCharacters(o.customPhrase ?? "").length}/30
            </p>
            {limitNotice && (
              <p className="hint" role="status">
                {limitNotice}
              </p>
            )}
            {!normalizePhrase(o.customPhrase ?? "") && (
              <p className="hint">
                留空时使用当前预设短句；换行由模板自动安排。
              </p>
            )}
          </>
        ) : (
          <label className="share-input-label">
            卡片短句
            <select
              value={o.phrase}
              onChange={(e) => set("phrase", Number(e.target.value))}
            >
              {phrases.map((p, i) => (
                <option key={p} value={i}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {error && (
        <p role="alert" className="feedback error">
          {error}
        </p>
      )}
      <div className="preview-entry">
        <button className="primary" onClick={preview}>
          预览卡片 <span aria-hidden="true">›</span>
        </button>
        <p className="hint">编辑只影响分享图片，不修改记录。</p>
      </div>
    </div>
  );
}

export function SharePreview({
  snapshot: frozen,
  data,
  today,
  options,
  onBack,
}: {
  snapshot: ShareCardSnapshot;
  data: Snapshot;
  today: string;
  options: ShareOptions;
  onBack: () => void;
}) {
  const [output, setOutput] = useState<{ url: string; blob: Blob } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState(0),
    [sharing, setSharing] = useState(false);
  let stale = false;
  try {
    stale =
      JSON.stringify(
        createShareSnapshot(data, options, today, new Date(frozen.generatedAt)),
      ) !== JSON.stringify(frozen);
  } catch {
    stale = true;
  }
  useEffect(() => {
    let cancelled = false,
      url = "";
    setOutput(null);
    setError("");
    setNotice("");
    void renderShareCard(frozen)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setOutput({ url, blob });
      })
      .catch(() => {
        if (!cancelled) setError("图片生成失败，编辑内容已保留。请重试。");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [frozen, retry]);
  const ready = stale ? null : output;
  const file = ready
    ? new File([ready.blob], `thinmuscle-${frozen.kind}-${frozen.date}.png`, {
        type: "image/png",
      })
    : null;
  let canShare = false;
  try {
    canShare = !!(
      file &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {}
  async function share() {
    if (!file || !canShare) return;
    setSharing(true);
    setNotice("");
    try {
      await navigator.share({ files: [file] });
      setNotice("已返回应用。是否发送以系统分享结果为准。");
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setNotice("系统分享未完成。你可以保存图片后手动分享。");
    } finally {
      setSharing(false);
    }
  }
  function save() {
    if (!ready || !file) return;
    try {
      const a = document.createElement("a");
      a.href = ready.url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setNotice("已请求保存；若没有下载，可长按图片或打开原图保存到“文件”。");
    } catch {
      setNotice("自动保存不可用，请长按图片或打开原图保存。");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(PRODUCT_URL);
      setNotice("已复制产品入口，不含个人记录。");
    } catch {
      setNotice("复制不可用，请选择下方链接手动复制。");
    }
  }
  return (
    <div className="share-preview-page">
      <button
        className="text-button share-back"
        disabled={sharing}
        onClick={onBack}
      >
        ‹ 返回编辑
      </button>
      <p className="hint">
        {templates[frozen.template]} · {contents[frozen.kind]}
      </p>
      {stale && (
        <p role="alert" className="feedback error">
          记录已变化，请返回编辑重新预览。
        </p>
      )}
      {error && (
        <>
          <p role="alert" className="feedback error">
            {error}
          </p>
          <button
            className="small-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            重试生成图片
          </button>
        </>
      )}
      <div className="share-preview" aria-busy={!output && !error}>
        {output ? (
          <img
            src={output.url}
            width={1080}
            height={1440}
            alt={`${templates[frozen.template]} · ${contents[frozen.kind]}，${frozen.date}，最终导出预览`}
          />
        ) : (
          <p role="status">{error ? "图片暂未生成" : "正在生成图片…"}</p>
        )}
      </div>
      <div className="share-actions">
        <button className="primary" disabled={!ready || sharing} onClick={save}>
          保存图片
        </button>
        <button
          className="small-button"
          disabled={!canShare || sharing}
          onClick={() => void share()}
        >
          {sharing ? "正在分享…" : "系统分享图片"}
        </button>
        <button className="small-button" onClick={() => void copy()}>
          复制产品链接
        </button>
      </div>
      {!canShare && ready && (
        <p className="hint">
          此浏览器不支持直接分享图片，请先保存，再到其他应用发送。
        </p>
      )}
      {notice && (
        <p className="share-notice" role="status">
          {notice}
        </p>
      )}
      {ready && (
        <a
          className="share-open-image"
          href={ready.url}
          target="_blank"
          rel="noreferrer"
        >
          打开原图（可长按保存）
        </a>
      )}
      <label className="share-input-label">
        产品入口 · 不包含个人结果
        <input
          readOnly
          value={PRODUCT_URL}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <p className="hint">
        1080×1440
        PNG。图片中的记录不会自动更新，也无法远程撤回。接收者使用自己的本地记录。
      </p>
    </div>
  );
}
