import { useViewState } from "./view-state";
import { Disclosure } from "./FoldSection";
import { askConfirm } from "./confirm";
import { useMuscle } from "./Onboarding";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Camera, Plus, Minus, RotateCcw } from "lucide-react";
import { db, type PhotoEntry } from "./data";
import { localDate, dateKey } from "./records";
import type { Run } from "./RecordForms";
import { Modal } from "./Modal";
import { preparePhoto } from "./photo-utils";
export { preparePhoto, photoTypes } from "./photo-utils";
function PhotoImage({
  photo,
  eager = false,
}: {
  photo: PhotoEntry;
  eager?: boolean;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(photo.image);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo.image]);
  return url ? (
    <img
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      src={url}
      alt={"照片记录 " + photo.date}
    />
  ) : null;
}
function ZoomPhoto({ photo }: { photo: PhotoEntry }) {
  const stage = useRef<HTMLDivElement>(null),
    image = useRef<HTMLDivElement>(null),
    points = useRef(new Map<number, { x: number; y: number }>()),
    transform = useRef({ scale: 1, x: 0, y: 0 }),
    start = useRef({ distance: 1, scale: 1, x: 0, y: 0, cx: 0, cy: 0 }),
    last = useRef({ x: 0, y: 0 }),
    frame = useRef<number | undefined>(undefined),
    [scale, setScale] = useState(1);
  const apply = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const t = transform.current;
      if (image.current)
        image.current.style.transform =
          "translate3d(" + t.x + "px," + t.y + "px,0) scale(" + t.scale + ")";
    });
  };
  const bound = () => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    const t = transform.current;
    t.x = Math.max(
      (-r.width * (t.scale - 1)) / 2,
      Math.min((r.width * (t.scale - 1)) / 2, t.x),
    );
    t.y = Math.max(
      (-r.height * (t.scale - 1)) / 2,
      Math.min((r.height * (t.scale - 1)) / 2, t.y),
    );
  };
  const zoom = (s: number) => {
    transform.current.scale = Math.max(1, Math.min(4, s));
    bound();
    setScale(transform.current.scale);
    apply();
  };
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const begin = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = { x: e.clientX, y: e.clientY };
    if (points.current.size === 2) {
      const [a, b] = [...points.current.values()];
      start.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: transform.current.scale,
        x: transform.current.x,
        y: transform.current.y,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size === 2) {
      const [a, b] = [...points.current.values()],
        s = start.current;
      transform.current = {
        scale: Math.max(
          1,
          Math.min(
            4,
            (s.scale * Math.hypot(a.x - b.x, a.y - b.y)) / s.distance,
          ),
        ),
        x: s.x + (a.x + b.x) / 2 - s.cx,
        y: s.y + (a.y + b.y) / 2 - s.cy,
      };
    } else if (transform.current.scale > 1) {
      transform.current.x += e.clientX - last.current.x;
      transform.current.y += e.clientY - last.current.y;
    }
    last.current = { x: e.clientX, y: e.clientY };
    bound();
    apply();
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    points.current.delete(e.pointerId);
    const remaining = [...points.current.values()][0];
    if (remaining) last.current = remaining;
    setScale(transform.current.scale);
  };
  return (
    <>
      <div
        ref={stage}
        className="zoom-surface"
        aria-label="照片缩放区域"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => zoom(transform.current.scale > 1 ? 1 : 2)}
      >
        <div ref={image} className="zoom-image">
          <PhotoImage photo={photo} eager />
        </div>
      </div>
      <div className="zoom-tools">
        <button
          className="icon-button"
          aria-label="缩小照片"
          onClick={() => zoom(scale - 0.5)}
        >
          <Minus size={18} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          className="icon-button"
          aria-label="放大照片"
          onClick={() => zoom(scale + 0.5)}
        >
          <Plus size={18} />
        </button>
        <button
          className="text-button"
          onClick={() => {
            transform.current = { scale: 1, x: 0, y: 0 };
            setScale(1);
            apply();
          }}
        >
          <RotateCcw size={15} />
          复位
        </button>
      </div>
    </>
  );
}
export function Photos({ photos, run }: { photos: PhotoEntry[]; run: Run }) {
  const [day, setDay] = useState(localDate()),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [viewer, setViewer] = useState<string | null>(null),
    [comparing, setComparing] = useState(false),
    [compareStage, setCompareStage] = useState(false),
    [compareDate, setCompareDate] = useState(""),
    [ascending, setAscending] = useViewState("photos.ascending", false),
    [seek, setSeek] = useViewState("photos.seek", ""),
    [expanded, setExpanded] = useViewState<Record<string, boolean>>(
      "photos.expanded",
      {},
    ),
    [limit, setLimit] = useViewState("photos.limit", 60),
    [error, setError] = useState("");
  const sorted = [...photos].sort(
      (a, b) =>
        (ascending ? 1 : -1) *
        (a.date.localeCompare(b.date) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id)),
    ),
    chosen = sorted.filter((p) => selected.includes(p.id)).slice(0, 4),
    photo = photos.find((p) => p.id === viewer);
  const months = [...new Set(sorted.map((p) => p.date.slice(0, 7)))];
  const dates = [...new Set(sorted.map((p) => p.date))];
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length < 4
          ? [...s, id]
          : s,
    );
  const muscle = useMuscle();
  return (
    <section className="photos">
      <div className="section-heading">
        <h2>{muscle}照片</h2>
        <span>{photos.length} 张 · 本机保存</span>
      </div>
      <div className="panel photo-upload">
        <p className="hint">
          相近光线和角度更易看见变化。JPG / PNG / WebP，每张不超过 15MB。
        </p>
        <div className="photo-upload-row">
          <label>
            照片日期
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </label>
          <div className="photo-capture-actions">
            <label className="upload-button">
              {busy ? "保存中…" : "拍照并保存"}
              <input
                aria-label={"拍摄" + muscle + "照片"}
                type="file"
                accept="image/*"
                capture="environment"
                disabled={busy || !day}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    await run(async () => {
                      const image = await preparePhoto(file);
                      await db.photos.put({
                        id: crypto.randomUUID(),
                        date: dateKey(day),
                        image,
                        createdAt: new Date().toISOString(),
                      });
                    }, "照片已保存到本机");
                  } finally {
                    setBusy(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <label className="upload-button">
              {busy ? "保存中…" : "从相册选择"}
              <input
                aria-label={"上传" + muscle + "照片"}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || !day}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  try {
                    await run(async () => {
                      const image = await preparePhoto(file);
                      await db.photos.put({
                        id: crypto.randomUUID(),
                        date: dateKey(day),
                        image,
                        createdAt: new Date().toISOString(),
                      });
                    }, "照片已保存到本机");
                  } finally {
                    setBusy(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        </div>
        <Disclosure className="photo-notes" memoryKey="photos.notes">
          <summary>照片保存说明</summary>
          <p className="hint">
            照片缩至最长边 1600 像素并保存在本机；不会上传，AI 分析未启用。
          </p>
        </Disclosure>
      </div>
      {!photos.length ? (
        <div className="empty">
          <Camera size={30} />
          <h2>第一张照片，就是起点。</h2>
          <p>选择照片后，将在这里按日期排列。</p>
        </div>
      ) : (
        <>
          <div className="photo-toolbar">
            <select
              aria-label="照片排序"
              value={ascending ? "asc" : "desc"}
              onChange={(e) => setAscending(e.target.value === "asc")}
            >
              <option value="desc">日期倒序</option>
              <option value="asc">日期正序</option>
            </select>
            <button
              className="small-button"
              onClick={() => {
                setComparing(true);
                setCompareStage(false);
                setCompareDate(dates[0] ?? "");
              }}
            >
              照片对比
            </button>
          </div>
          <div className="photo-toolbar">
            <input
              aria-label="定位照片日期"
              type="date"
              value={seek}
              onChange={(e) => setSeek(e.target.value)}
            />
            <button
              className="small-button"
              onClick={() => {
                const found = sorted.find((p) => p.date === seek);
                if (!found) {
                  setError("这一天还没有照片");
                  return;
                }
                setError("");
                setExpanded((v) => ({ ...v, [seek.slice(0, 7)]: true }));
                setLimit(
                  Math.max(
                    limit,
                    sorted
                      .filter((p) => p.date.slice(0, 7) === seek.slice(0, 7))
                      .findIndex((p) => p.id === found.id) + 1,
                  ),
                );
                setTimeout(
                  () =>
                    document
                      .getElementById("photo-" + found.id)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  100,
                );
              }}
            >
              定位日期
            </button>
          </div>
          {error && (
            <p role="status" className="hint">
              {error}
            </p>
          )}
          {months.map((month) => (
            <Disclosure
              className="photo-month"
              lazy
              key={month}
              open={expanded[month] ?? month === months[0]}
              onToggle={(e) => {
                const value = e.currentTarget.open;
                setExpanded((s) =>
                  s[month] === value ? s : { ...s, [month]: value },
                );
              }}
            >
              <summary>
                {month.slice(0, 4)}年{Number(month.slice(5))}月
                <span>
                  {sorted.filter((p) => p.date.startsWith(month)).length} 张
                </span>
              </summary>
              {true && (
                <>
                  <div className="photo-grid">
                    {sorted
                      .filter((p) => p.date.startsWith(month))
                      .slice(0, limit)
                      .map((p) => (
                        <article
                          id={"photo-" + p.id}
                          className={
                            "photo-card " +
                            (p.date === seek ? "photo-day-target" : "")
                          }
                          key={p.id}
                        >
                          <button
                            className="thumbnail"
                            aria-label={
                              "查看照片 " +
                              p.date +
                              " 第" +
                              (sorted.indexOf(p) + 1) +
                              "张"
                            }
                            onClick={() => {
                              setError("");
                              setViewer(p.id);
                            }}
                          >
                            <PhotoImage photo={p} />
                          </button>
                          <time dateTime={p.date}>
                            {p.date.slice(2).replaceAll("-", "/")}
                          </time>
                        </article>
                      ))}
                  </div>
                  {sorted.filter((p) => p.date.startsWith(month)).length >
                    limit && (
                    <button
                      className="small-button"
                      onClick={() => setLimit((n) => n + 60)}
                    >
                      显示更多照片
                    </button>
                  )}
                </>
              )}
            </Disclosure>
          ))}
        </>
      )}
      {photo && (
        <Modal
          title={"照片 · " + photo.date}
          className="photo-viewer"
          onClose={() => setViewer(null)}
        >
          <ZoomPhoto key={photo.id} photo={photo} />

          {error && <p role="alert">{error}</p>}
          <button
            className="text-button danger"
            disabled={busy}
            onClick={async () => {
              if (
                !(await askConfirm(
                  "删除这张本地照片？建议先备份。",
                  "删除照片",
                ))
              )
                return;
              setBusy(true);
              try {
                const ok = await run(
                  () => db.photos.delete(photo.id),
                  "照片已删除",
                );
                if (ok) {
                  setSelected((s) => s.filter((id) => id !== photo.id));
                  setViewer(null);
                } else setError("删除失败，请重试。");
              } finally {
                setBusy(false);
              }
            }}
          >
            删除照片
          </button>
        </Modal>
      )}
      {comparing && (
        <Modal
          title="照片对比"
          className="compare-viewer"
          onClose={() => setComparing(false)}
        >
          {!compareStage ? (
            <div className="compare-picker">
              <label>
                选择照片日期
                <select
                  value={compareDate}
                  onChange={(e) => setCompareDate(e.target.value)}
                >
                  {dates.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <p className="hint">选择2至4张照片，可切换日期继续选择。</p>
              <div className="photo-grid">
                {sorted
                  .filter((p) => p.date === compareDate)
                  .map((p, i) => (
                    <article className="photo-card" key={p.id}>
                      <button
                        className="thumbnail"
                        aria-label={
                          "选择对比 " + p.date + " 第" + (i + 1) + "张"
                        }
                        aria-pressed={selected.includes(p.id)}
                        disabled={
                          chosen.length >= 4 && !selected.includes(p.id)
                        }
                        onClick={() => toggle(p.id)}
                      >
                        <PhotoImage photo={p} />
                        {selected.includes(p.id) && (
                          <span className="photo-picked">✓</span>
                        )}
                      </button>
                    </article>
                  ))}
              </div>
              <div className="selected-photos">
                {chosen.map((p) => (
                  <button
                    key={p.id}
                    aria-label={"取消已选照片 " + p.id}
                    onClick={() => toggle(p.id)}
                  >
                    <PhotoImage photo={p} />
                    <span>×</span>
                  </button>
                ))}
              </div>
              <button
                className="primary"
                disabled={chosen.length < 2}
                onClick={() => setCompareStage(true)}
              >
                开始对比（{chosen.length}/4）
              </button>
            </div>
          ) : (
            <>
              <div className="comparison" aria-label="照片对比">
                {[...chosen]
                  .sort(
                    (a, b) =>
                      a.date.localeCompare(b.date) ||
                      a.createdAt.localeCompare(b.createdAt),
                  )
                  .map((p) => (
                    <figure key={p.id}>
                      <PhotoImage photo={p} eager />
                      <figcaption>{p.date}</figcaption>
                    </figure>
                  ))}
              </div>
              <button
                className="text-button"
                onClick={() => setCompareStage(false)}
              >
                返回选择
              </button>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}
