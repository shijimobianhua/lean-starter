import { readDraft, clearDraft, useDraftProtection } from "./drafts";
import { Disclosure } from "./FoldSection";
import { useState, useMemo } from "react";
import { Modal } from "./Modal";
import { askConfirm } from "./confirm";
import { useMuscle } from "./Onboarding";
import { db, type Profile } from "./data";
import { type Snapshot } from "./records";
import {
  exerciseCatalog,
  categories,
  parameters,
  saveWorkouts,
} from "./catalog";
import {
  type ExerciseDefinition,
  type WorkoutItem,
  type ExerciseKind,
  validateWorkout,
  toDisplay,
  toKg,
} from "./domain";
import { useWeightUnit, updateProfile } from "./units";
import type { Run } from "./RecordForms";
export function TrainingEditor({
  date,
  data,
  run,
  onClose,
}: {
  date: string;
  data: Snapshot;
  run: Run;
  onClose: () => void;
}) {
  const old = data.training.find((x) => x.date === date),
    muscle = useMuscle();
  const draftKey = "training:" + date + ":" + (old?.updatedAt ?? "new");
  const [saved] = useState(() =>
    readDraft<{ items: WorkoutItem[]; status: "trained" | "rest" }>(draftKey),
  );
  const [items, setItems] = useState(saved?.items ?? old?.items ?? []),
    [status, setStatus] = useState<"trained" | "rest">(
      saved?.status ?? old?.status ?? "trained",
    ),
    [dirty, setDirty] = useState(!!saved),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [finished, setFinished] = useState(false),
    [picker, setPicker] = useState(false),
    [editing, setEditing] = useState<WorkoutItem>();
  const legacy = {
    aerobic: old?.aerobic ?? "",
    anaerobic: old?.anaerobic ?? "",
  };
  const draftValue = useMemo(() => ({ items, status }), [items, status]);
  const draftError = useDraftProtection(
    draftKey,
    draftValue,
    dirty && !finished,
  );
  const guard = () =>
    !busy &&
    (!dirty ||
      askConfirm("还有未保存的修改，确定放弃？").then((ok) => {
        if (ok) {
          clearDraft(draftKey);
          setDirty(false);
        }
        return ok;
      }));
  return (
    <Modal
      title={muscle + "记录"}
      closeLabel="关闭记录"
      onClose={onClose}
      closeRequested={finished}
      canClose={guard}
    >
      <p className="hint">{date}</p>
      {saved && (
        <p className="hint" role="status">
          已恢复上次未保存的训练草稿
        </p>
      )}
      {draftError && <p role="alert">{draftError}</p>}
      <div className="segments">
        {(["trained", "rest"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setDirty(true);
            }}
          >
            {s === "trained" ? "今天练了" : "今日休息"}
          </button>
        ))}
      </div>
      {status === "trained" && (
        <section className="workout-list">
          <h3>训练</h3>
          {(legacy.aerobic || legacy.anaerobic) && (
            <Disclosure>
              <summary>之前的文字记录</summary>
              <p>
                {[legacy.aerobic, legacy.anaerobic].filter(Boolean).join("；")}
              </p>
              <small>原记录保留，未填写的时长不计入统计</small>
            </Disclosure>
          )}
          {items.map((item) => (
            <div className="workout-row" key={item.id}>
              <button
                className="text-button"
                onClick={() => {
                  setEditing(item);
                  setPicker(true);
                }}
              >
                <strong>{item.name}</strong>
                <small>
                  {item.kind} · {item.minutes} 分钟
                </small>
              </button>
              <button
                aria-label={"移除" + item.name}
                onClick={() => {
                  setItems((s) => s.filter((x) => x.id !== item.id));
                  setDirty(true);
                }}
              >
                移除
              </button>
            </div>
          ))}
          <button
            className="full-button"
            onClick={() => {
              setEditing(undefined);
              setPicker(true);
            }}
          >
            ＋ 添加训练
          </button>
          <p className="hint">
            合计 {Number(items.reduce((s, x) => s + x.minutes, 0).toFixed(1))}{" "}
            分钟
          </p>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="editor-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            const ok = await run(async () => {
              try {
                await saveWorkouts(date, status, items, legacy);
              } catch (e) {
                setError(e instanceof Error ? e.message : "保存失败");
                throw e;
              }
            }, muscle + "已保存");
            setBusy(false);
            if (ok) {
              clearDraft(draftKey);
              setDirty(false);
              setFinished(true);
            }
          }}
        >
          保存{muscle}
        </button>
        {old && (
          <button
            className="text-button danger"
            disabled={busy}
            onClick={async () => {
              if (await askConfirm("删除这一天的训练记录？", "删除记录")) {
                if (
                  await run(() => db.training.delete(date), "训练记录已删除")
                ) {
                  clearDraft(draftKey);
                  setDirty(false);
                  setFinished(true);
                }
              }
            }}
          >
            删除此记录
          </button>
        )}
      </div>
      {picker && (
        <ExercisePicker
          draftKey={draftKey + ":picker:" + (editing?.id ?? "new")}
          profile={data.profile}
          training={data.training.flatMap((x) => x.items ?? [])}
          initial={editing}
          onClose={() => setPicker(false)}
          onAdd={(item) => {
            setItems((s) =>
              editing
                ? s.map((x) => (x.id === editing.id ? item : x))
                : [...s, item],
            );
            setDirty(true);
            setPicker(false);
          }}
        />
      )}
    </Modal>
  );
}
function ExercisePicker({
  draftKey,
  profile,
  training,
  initial,
  onClose,
  onAdd,
}: {
  draftKey: string;
  profile?: Profile;
  training: WorkoutItem[];
  initial?: WorkoutItem;
  onClose: () => void;
  onAdd: (item: WorkoutItem) => void;
}) {
  const [saved] = useState(() =>
    readDraft<{
      selected?: ExerciseDefinition;
      draft: Record<string, string>;
      name: string;
      customKind: ExerciseKind;
      custom: boolean;
      unit: string;
    }>(draftKey),
  );
  const [completed, setCompleted] = useState<WorkoutItem>(),
    [changed, setChanged] = useState(!!saved);
  const all = [...exerciseCatalog, ...(profile?.customExercises ?? [])],
    unit = useWeightUnit();
  const [category, setCategory] = useState(training.length ? "最近" : "全部"),
    [search, setSearch] = useState(""),
    [kind, setKind] = useState("全部"),
    [place, setPlace] = useState("全部"),
    [equipment, setEquipment] = useState("全部"),
    [selected, setSelected] = useState<ExerciseDefinition | undefined>(
      saved?.selected ??
        (initial
          ? (all.find((x) => x.id === initial.exerciseId) ?? {
              id: initial.exerciseId,
              name: initial.name,
              category: initial.category,
              kind: initial.kind,
              place: "均可",
              equipment: false,
              parameters: Object.keys(initial).filter(
                (k) => k in parameters || k === "swimStyle",
              ),
            })
          : undefined),
    ),
    [draft, setDraft] = useState<Record<string, string>>(
      (saved?.draft
        ? {
            ...saved.draft,
            ...(saved.draft.loadKg && saved.unit !== unit
              ? {
                  loadKg: String(
                    toDisplay(
                      toKg(
                        Number(saved.draft.loadKg),
                        saved.unit === "斤" ? "斤" : "kg",
                      ),
                      unit,
                    ),
                  ),
                }
              : {}),
          }
        : undefined) ??
        (initial
          ? Object.fromEntries(
              Object.entries(initial).map(([k, v]) => [
                k,
                String(k === "loadKg" ? toDisplay(Number(v), unit) : v),
              ]),
            )
          : {}),
    ),
    [error, setError] = useState(""),
    [custom, setCustom] = useState(saved?.custom ?? false),
    [name, setName] = useState(saved?.name ?? ""),
    [customKind, setCustomKind] = useState<ExerciseKind>(
      saved?.customKind ?? "综合",
    ),
    [favorites, setFavorites] = useState(profile?.favoriteExercises ?? []);
  const pickerValue = useMemo(
    () => ({ selected, draft, name, customKind, custom, unit }),
    [selected, draft, name, customKind, custom, unit],
  );
  const draftError = useDraftProtection(
    draftKey,
    pickerValue,
    changed && !completed,
  );
  const recent = [
    ...new Set(
      training
        .slice()
        .reverse()
        .map((x) => x.exerciseId),
    ),
  ];
  const rows = all.filter(
    (x) =>
      (!search
        ? category === "最近"
          ? recent.includes(x.id)
          : category === "常用"
            ? favorites.includes(x.id)
            : category === "自定义"
              ? x.custom
              : category === "全部" || x.category === category
        : x.name.includes(search)) &&
      (kind === "全部" || x.kind === kind) &&
      (place === "全部" || x.place === "均可" || x.place === place) &&
      (equipment === "全部" || x.equipment === (equipment === "有器械")),
  );
  return (
    <Modal
      title={selected ? "训练详情" : "添加训练"}
      className="exercise-picker"
      onClose={() => {
        clearDraft(draftKey);
        completed ? onAdd(completed) : onClose();
      }}
      closeRequested={!!completed}
      canClose={() =>
        !changed ||
        askConfirm("还有未添加的训练，确定放弃？").then((ok) => {
          if (ok) {
            clearDraft(draftKey);
            setChanged(false);
          }
          return ok;
        })
      }
    >
      {saved && (
        <p className="hint" role="status">
          已恢复上次未添加的训练详情
        </p>
      )}
      {draftError && <p role="alert">{draftError}</p>}
      {selected ? (
        <form
          onChange={() => setChanged(true)}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const r: Record<string, unknown> = {
                id: initial?.id ?? crypto.randomUUID(),
                exerciseId: selected.id,
                name: selected.name,
                category: selected.category,
                kind: selected.kind,
                minutes: Number(draft.minutes),
              };
              for (const k of [...selected.parameters, "note"]) {
                const v = draft[k];
                if (v?.trim())
                  r[k] =
                    k === "swimStyle" || k === "note"
                      ? v
                      : k === "loadKg"
                        ? toKg(Number(v), unit)
                        : Number(v);
              }
              setCompleted(validateWorkout(r));
            } catch (e) {
              setError(e instanceof Error ? e.message : "请检查输入");
            }
          }}
        >
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              if (
                !changed ||
                (await askConfirm("还有未添加的训练，确定放弃？"))
              ) {
                clearDraft(draftKey);
                setSelected(undefined);
                setDraft({});
                setChanged(false);
              }
            }}
          >
            返回运动列表
          </button>
          <h3>{selected.name}</h3>
          <p className="hint">
            {selected.kind} · {selected.category}
          </p>
          <div className="parameter-grid">
            {["minutes", ...selected.parameters].map((k) => (
              <label key={k}>
                {k === "swimStyle"
                  ? "泳姿"
                  : k === "loadKg"
                    ? "负重（" + unit + "）"
                    : parameters[k]?.label}
                <input
                  type={k === "swimStyle" ? "text" : "number"}
                  required={k === "minutes"}
                  min={k === "minutes" ? 0.1 : 0}
                  max={
                    k === "loadKg" ? toDisplay(1000, unit) : parameters[k]?.max
                  }
                  step={parameters[k]?.step ?? 1}
                  value={draft[k] ?? ""}
                  onChange={(e) =>
                    setDraft((s) => ({ ...s, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <label>
            备注
            <textarea
              maxLength={300}
              value={draft.note ?? ""}
              onChange={(e) =>
                setDraft((s) => ({ ...s, note: e.target.value }))
              }
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="primary">
            {initial ? "保存训练项目" : "添加到当天训练"}
          </button>
        </form>
      ) : (
        <>
          <label className="search-field">
            搜索运动
            <input
              type="search"
              placeholder="输入运动名称"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="exercise-filters">
            <select
              aria-label="运动类型"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {["全部", "有氧", "无氧", "综合"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="场地"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            >
              {["全部", "室内", "室外"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="器械"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              {["全部", "有器械", "无器械"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="exercise-browser">
            <div className="exercise-categories">
              {["最近", "常用", "全部", "自定义", ...categories].map((x) => (
                <button
                  key={x}
                  aria-pressed={category === x}
                  onClick={() => setCategory(x)}
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="exercise-results">
              {!rows.length && (
                <p className="hint">暂无项目，可切换分类或添加自定义运动</p>
              )}
              {rows.map((x) => (
                <div className="exercise-result" key={x.id}>
                  <button
                    onClick={() => {
                      setSelected(x);
                      setDraft({});
                      setError("");
                    }}
                  >
                    <span>{x.name}</span>
                    <small>
                      {x.kind} · {x.place} · {x.equipment ? "有器械" : "无器械"}
                    </small>
                  </button>
                  <button
                    aria-label={
                      (favorites.includes(x.id) ? "取消常用" : "设为常用") +
                      x.name
                    }
                    aria-pressed={favorites.includes(x.id)}
                    onClick={async () => {
                      const next = favorites.includes(x.id)
                        ? favorites.filter((id) => id !== x.id)
                        : [...favorites, x.id];
                      try {
                        await updateProfile({ favoriteExercises: next });
                        setFavorites(next);
                      } catch {
                        setError("常用运动保存失败，请重试");
                      }
                    }}
                  >
                    {favorites.includes(x.id) ? "★" : "☆"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="text-button" onClick={() => setCustom(true)}>
            ＋ 自定义运动
          </button>
          {error && <p role="alert">{error}</p>}
          {custom && (
            <Modal title="自定义运动" onClose={() => setCustom(false)}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const x: ExerciseDefinition = {
                    id: "custom-" + crypto.randomUUID(),
                    name: name.trim(),
                    kind: customKind,
                    category: "自定义",
                    place: "均可",
                    equipment: false,
                    parameters: [],
                    custom: true,
                  };
                  try {
                    if (!x.name || x.name.length > 80)
                      throw Error("名称请填写1–80字");
                    await updateProfile({
                      customExercises: [...(profile?.customExercises ?? []), x],
                    });
                    setCustom(false);
                    setSelected(x);
                    setDraft({});
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "保存失败");
                  }
                }}
              >
                <label>
                  运动名称
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  运动类型
                  <select
                    value={customKind}
                    onChange={(e) =>
                      setCustomKind(e.target.value as ExerciseKind)
                    }
                  >
                    {["有氧", "无氧", "综合"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <button className="primary">创建并填写时长</button>
              </form>
            </Modal>
          )}
        </>
      )}
    </Modal>
  );
}
