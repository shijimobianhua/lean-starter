import stableExerciseIds from "./exercise-ids.json";
import type { ExerciseDefinition, ExerciseKind, WorkoutItem } from "./domain";
import { validateWorkout } from "./domain";
import { db, type TrainingEntry } from "./data";
import { dateKey } from "./records";
const groups: [
  string,
  ExerciseKind,
  ExerciseDefinition["place"],
  boolean,
  string[],
  string,
][] = [
  [
    "步行",
    "有氧",
    "室外",
    false,
    ["distanceKm", "speedKmh"],
    "散步|快走|健走|徒步|登山",
  ],
  [
    "跑步",
    "有氧",
    "室外",
    false,
    ["distanceKm", "speedKmh"],
    "慢跑|户外跑步|间歇跑|越野跑",
  ],
  [
    "骑行",
    "有氧",
    "室外",
    true,
    ["distanceKm", "speedKmh"],
    "城市骑行|公路骑行|山地骑行",
  ],
  ["球类", "综合", "均可", true, [], "篮球|足球|羽毛球|网球|乒乓球|排球|壁球"],
  [
    "水上运动",
    "有氧",
    "均可",
    true,
    ["distanceKm", "swimStyle"],
    "游泳|划船|桨板",
  ],
  [
    "有氧器械",
    "有氧",
    "室内",
    true,
    ["speedKmh", "distanceKm"],
    "跑步机跑步|椭圆机|动感单车|划船机|踏步机",
  ],
  [
    "有氧器械",
    "有氧",
    "室内",
    true,
    ["inclinePercent", "speedKmh", "distanceKm"],
    "跑步机爬坡",
  ],
  [
    "力量训练",
    "无氧",
    "室内",
    true,
    ["loadKg", "sets", "reps"],
    "杠铃深蹲|杠铃卧推|硬拉|哑铃划船|哑铃推举|哑铃弯举|哑铃侧平举|高位下拉|坐姿划船|腿举|腿屈伸|腿弯举|绳索下压|壶铃摆动|臀推",
  ],
  [
    "徒手训练",
    "无氧",
    "均可",
    false,
    ["sets", "reps"],
    "俯卧撑|引体向上|徒手深蹲|弓步蹲|卷腹|仰卧举腿|平板支撑|臀桥|登山者",
  ],
  [
    "健身综合",
    "综合",
    "均可",
    false,
    ["sets", "reps"],
    "波比跳|HIIT|循环训练|跳绳|开合跳",
  ],
  ["舞蹈跳操", "有氧", "均可", false, [], "有氧操|健身舞|尊巴|街舞"],
  ["武术格斗", "综合", "均可", false, [], "太极拳|拳击|跆拳道|武术"],
  [
    "柔韧拉伸",
    "综合",
    "均可",
    false,
    [],
    "瑜伽|普拉提|动态拉伸|静态拉伸|泡沫轴放松",
  ],
  ["其他运动", "综合", "室外", true, ["distanceKm"], "滑雪|滑冰|轮滑|攀岩"],
];
export const exerciseCatalog: ExerciseDefinition[] = groups.flatMap(
  ([category, kind, place, equipment, parameters, names], g) =>
    names.split("|").map((name, n) => ({
      id:
        stableExerciseIds[name as keyof typeof stableExerciseIds] ??
        "exercise-name-" + encodeURIComponent(name),
      name,
      category,
      kind,
      place,
      equipment,
      parameters,
    })),
);
export const categories = [...new Set(exerciseCatalog.map((x) => x.category))];
export const parameters: Record<
  string,
  { label: string; max: number; step?: number }
> = {
  minutes: { label: "时长（分钟）", max: 1440, step: 0.1 },
  speedKmh: { label: "速度（km/h）", max: 100, step: 0.1 },
  inclinePercent: { label: "坡度（%）", max: 100, step: 0.1 },
  distanceKm: { label: "距离（km）", max: 2000, step: 0.01 },
  loadKg: { label: "负重", max: 1000, step: 0.1 },
  sets: { label: "组数", max: 1000 },
  reps: { label: "次数", max: 10000 },
};
export const workoutMinutes = (t?: TrainingEntry) =>
  t?.status === "trained"
    ? (t.items ?? []).reduce((s, x) => s + x.minutes, 0)
    : 0;
export async function saveWorkouts(
  date: string,
  status: "trained" | "rest",
  items: WorkoutItem[],
  legacy: { aerobic: string; anaerobic: string },
) {
  const checked = status === "rest" ? [] : items.map(validateWorkout);
  if (
    new Set(checked.map((x) => x.id)).size !== checked.length ||
    checked.length > 100 ||
    checked.reduce((s, x) => s + x.minutes, 0) > 1440
  )
    throw Error("训练项目重复或总时长超过一天");
  if (
    status === "trained" &&
    !checked.length &&
    !legacy.aerobic.trim() &&
    !legacy.anaerobic.trim()
  )
    throw Error("请添加训练项目");
  await db.training.put({
    date: dateKey(date),
    status,
    items: checked,
    aerobic: status === "rest" ? "" : legacy.aerobic,
    anaerobic: status === "rest" ? "" : legacy.anaerobic,
    updatedAt: new Date().toISOString(),
  });
}
