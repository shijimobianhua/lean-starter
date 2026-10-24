import { SOURCE_REPOSITORY_URL } from "./share-config";
import { LeanHome, LeanHeader } from "./LeanHome";
import { normalizeStyle } from "./ui-style";
import { APP_VERSION } from "./version";
import { BodyProfile } from "./BodyProfile";
import { ViewStateProvider } from "./view-state";
import { ConfirmHost } from "./confirm";
import { UnitProvider } from "./units";
import { displayWeight } from "./domain";
import { HomeStack, WeightPlanSettings } from "./WeightPlan";
import { SettingsExtras } from "./SettingsExtras";
import { useDisclosureMotion } from "./disclosure";
import { useNativeInteractions } from "./eighth-interaction";
import { ToastQueue } from "./ToastQueue";
import { Achievement } from "./Achievement";
import { ResetPanel } from "./ResetPanel";
import { InstallPanel } from "./InstallPanel";
import { useEffect, useState, lazy, Suspense } from "react";
import { liveQuery } from "dexie";
import {
  Sun,
  ChartNoAxesCombined,
  CalendarDays,
  UserRound,
  ChevronRight,
  Droplets,
  Moon,
  Scale,
  Camera,
  Monitor,
  Check,
  Dumbbell,
} from "lucide-react";
import {
  Onboarding,
  GenderSettings,
  MuscleProvider,
  MuscleText,
} from "./Onboarding";
import type { ThemeMode } from "./data";
import {
  snapshot,
  emptyData,
  localDate,
  sleepHours,
  waterTotal,
  type Snapshot,
} from "./records";
import { type Run } from "./RecordForms";
import { RecordEditor, type RecordKind } from "./RecordEditor";
import { CalendarPage } from "./CalendarPage";
import { Photos } from "./Photos";
import { useDataProtection } from "./protection";
import { ProtectionPanel, RecoveryNotice } from "./ProtectionPanel";
import { BackupPanel } from "./BackupPanel";
import { PwaStatus } from "./pwa";
import { QuotePanel } from "./QuotePanel";
import { ensureDailyQuote } from "./quotes";
import { useAppInteraction } from "./interaction";
const Trends = lazy(() =>
  import("./Trends").then((m) => ({ default: m.Trends })),
);
const tabs = [
  { name: "今天", icon: Sun },
  { name: "趋势", icon: ChartNoAxesCombined },
  { name: "日历", icon: CalendarDays },
  { name: "我的", icon: UserRound },
];
export default function App() {
  return (
    <ViewStateProvider>
      <DailyApp />
    </ViewStateProvider>
  );
}
function DailyApp() {
  useAppInteraction();
  useDisclosureMotion();
  useNativeInteractions();
  const [cacheReady, setCacheReady] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [page, setPage] = useState("今天"),
    [data, setData] = useState<Snapshot>(emptyData),
    [loaded, setLoaded] = useState(false),
    [dbError, setDbError] = useState(""),
    [retry, setRetry] = useState(0),
    [message, setMessage] = useState(""),
    [isError, setIsError] = useState(false),
    [today, setToday] = useState(localDate()),
    [editor, setEditor] = useState<{ kind: RecordKind; date: string } | null>(
      null,
    ),
    [photoView, setPhotoView] = useState(false);
  const [mode, setMode] = useState<ThemeMode>(() => {
      try {
        const v = localStorage.getItem("form-theme");
        return v === "light" || v === "dark" ? v : "system";
      } catch {
        return "system";
      }
    }),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = mode === "system" ? (mq.matches ? "dark" : "light") : mode;
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "dark" ? "#141312" : "#f1f2f4");
    };
    apply();
    mq.addEventListener("change", apply);
    try {
      localStorage.setItem("form-theme", mode);
    } catch {
      setNotice("主题偏好暂时无法保存，本次切换仍然有效。");
    }
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 30000);
    const wake = () => setToday(localDate());
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", wake);
    };
  }, []);
  useEffect(() => {
    setDbError("");
    const sub = liveQuery(snapshot).subscribe({
      next: (d) => {
        setData(d);
        setLoaded(true);
      },
      error: () => {
        setDbError("本地数据库暂时不可用，请允许浏览器保存网站数据后重试。");
        setLoaded(false);
      },
    });
    return () => sub.unsubscribe();
  }, [retry]);
  useEffect(() => {
    if (loaded) void ensureDailyQuote(today).catch(() => {});
  }, [
    loaded,
    today,
    data.quotes.length,
    data.profile?.hiddenQuotes?.join(","),
  ]);
  useEffect(() => {
    if (!loaded) return;
    const style = normalizeStyle(data.profile?.style);
    document.documentElement.dataset.style = style;
    try {
      localStorage.setItem("form-style", style);
    } catch {}
  }, [data.profile?.style, loaded]);
  const lean = normalizeStyle(data.profile?.style) === "lean";
  const protection = useDataProtection(data, loaded);
  const [dismissedRecovery, setDismissedRecovery] = useState(false);
  const recoveryNeeded = !!protection.candidate && !dismissedRecovery;
  const onboarding =
    loaded &&
    protection.ready &&
    protection.checked &&
    !recoveryNeeded &&
    !data.profile?.onboardingDone &&
    !data.profile?.gender &&
    !data.profile?.heightCm &&
    !data.profile?.chestCm &&
    !data.profile?.waistCm &&
    !data.profile?.hipCm &&
    !data.profile?.weightPlan &&
    !data.profile?.customExercises?.length &&
    !data.weights.length &&
    !data.water.length &&
    !data.sleep.length &&
    !data.training.length &&
    !data.photos.length &&
    !data.quotes.length;
  const run: Run = async (action, success) => {
    try {
      await action();
      setIsError(false);
      setMessage("");
      window.dispatchEvent(new CustomEvent("daily-toast", { detail: success }));
      return true;
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error ? e.message : "保存失败，请重试；输入仍保留。",
      );
      return false;
    }
  };
  const open = (kind: RecordKind, date = today) => {
    setMessage("");
    setEditor({ kind, date });
  };
  const w = data.weights.find((r) => r.date === today),
    water = data.water.find((r) => r.date === today),
    sleep = data.sleep.find((r) => r.wakeDate === today),
    training = data.training.find((r) => r.date === today);
  return (
    <UnitProvider value={data.profile?.weightUnit ?? "kg"}>
      <MuscleProvider gender={data.profile?.gender}>
        <div className="shell" data-ui-style={lean ? "lean" : "default"}>
          <PwaStatus
            onCacheReady={setCacheReady}
            blocked={!!editor || sharingOpen || !loaded || onboarding}
          />
          <ToastQueue />
          <ConfirmHost />
          {onboarding && <Onboarding profile={data.profile} />}
          <main id="main" inert={onboarding}>
            <div className="page-transition" key={page + String(photoView)}>
              {message && !editor && (
                <div
                  className={"feedback " + (isError ? "error" : "")}
                  role={isError ? "alert" : "status"}
                >
                  {message}
                  <button onClick={() => setMessage("")} aria-label="关闭消息">
                    ×
                  </button>
                </div>
              )}
              {dbError && (
                <div className="feedback error" role="alert">
                  {dbError}
                  <button onClick={() => setRetry((v) => v + 1)}>重试</button>
                </div>
              )}
              {!loaded && !dbError && <p className="hint">正在读取本机记录…</p>}
              {protection.warning && (
                <p className="hint" role="status">
                  {protection.warning}
                </p>
              )}
              {recoveryNeeded && (
                <RecoveryNotice
                  candidate={protection.candidate!}
                  run={run}
                  onDismiss={() => setDismissedRecovery(true)}
                />
              )}
              {dbError && <ProtectionPanel run={run} />}
              {loaded &&
                protection.ready &&
                (photoView ? (
                  <>
                    <button
                      className="small-button"
                      onClick={() => setPhotoView(false)}
                    >
                      返回{page}
                    </button>
                    <Photos photos={data.photos} run={run} />
                  </>
                ) : (
                  <>
                    {lean && <LeanHeader page={page} today={today} />}
                    {page === "今天" &&
                      (lean ? (
                        <LeanHome
                          data={data}
                          today={today}
                          open={open}
                          onPhotos={() => setPhotoView(true)}
                        />
                      ) : (
                        <>
                          <HomeStack data={data} today={today} />
                          <div className="section-heading">
                            <h2 className="home-metrics-title">
                              五倍做多自己的身体
                            </h2>
                          </div>
                          <section className="metrics home-metrics">
                            <Metric
                              icon={Droplets}
                              label="大水"
                              value={
                                water
                                  ? (waterTotal(water) / 1500).toFixed(2)
                                  : ""
                              }
                              unit="大水"
                              text={
                                water
                                  ? waterTotal(water) +
                                    " ml · 早上 / 中午 / 晚上"
                                  : "1 大水 = 1500ml · 点击记录"
                              }
                              color="blue"
                              disabled={!loaded}
                              onClick={() => open("大水")}
                            />
                            <Metric
                              icon={Moon}
                              label="大睡"
                              value={sleep ? sleepHours(sleep).toFixed(1) : ""}
                              unit="小时"
                              text={sleep ? "按起床日归档" : "只选几点到几点"}
                              color="lavender"
                              disabled={!loaded}
                              onClick={() => open("大睡")}
                            />
                            <Metric
                              icon={Dumbbell}
                              label={
                                data.profile?.gender === "female"
                                  ? "马甲线"
                                  : "薄肌"
                              }
                              value={
                                training
                                  ? training.status === "rest"
                                    ? "今日休息"
                                    : "今日已练"
                                  : ""
                              }
                              unit=""
                              text={
                                training?.status === "trained"
                                  ? training.items?.length
                                    ? training.items
                                        .map(
                                          (x) =>
                                            x.name + " " + x.minutes + "分钟",
                                        )
                                        .join(" · ")
                                    : [
                                        training.aerobic &&
                                          "有氧：" + training.aerobic,
                                        training.anaerobic &&
                                          "无氧：" + training.anaerobic,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")
                                  : training
                                    ? "好好休息，也在向前"
                                    : "有氧 / 无氧，记下实际练了什么"
                              }
                              color="peach"
                              disabled={!loaded}
                              onClick={() => open("薄肌")}
                            />
                            <Metric
                              icon={Scale}
                              label="体重"
                              value={
                                w
                                  ? String(
                                      displayWeight(
                                        w.weightKg,
                                        data.profile?.weightUnit ?? "kg",
                                      ),
                                    )
                                  : ""
                              }
                              unit={data.profile?.weightUnit ?? "kg"}
                              text="每日一条 · 点击记录或修改"
                              color="neutral"
                              disabled={!loaded}
                              onClick={() => open("体重")}
                            />
                          </section>
                          <button
                            className="photo-callout full-button"
                            disabled={!loaded}
                            onClick={() => setPhotoView(true)}
                          >
                            <div className="photo-icon">
                              <Camera size={26} />
                            </div>
                            <div>
                              <h3>把变化，交给时间。</h3>
                              <p>
                                <MuscleText />
                                照片 · {data.photos.length} 张
                              </p>
                            </div>
                            <ChevronRight size={20} className="entry-chevron" />
                          </button>
                        </>
                      ))}
                    {page === "趋势" && loaded && (
                      <Suspense
                        fallback={<p className="hint">正在载入趋势…</p>}
                      >
                        <Trends
                          data={data}
                          run={run}
                          onHeight={() => setPage("我的")}
                        />
                      </Suspense>
                    )}
                    {page === "日历" && loaded && (
                      <CalendarPage data={data} open={open} />
                    )}
                    {page === "我的" && (
                      <div className="settings-page">
                        {!lean && (
                          <>
                            <AppearanceSettings
                              mode={mode}
                              setMode={setMode}
                              notice={notice}
                            />
                          </>
                        )}
                        {loaded && (
                          <>
                            <BodyProfile
                              data={data}
                              run={run}
                              lean={lean}
                              onActiveChange={setSharingOpen}
                            />
                            <GenderSettings profile={data.profile} run={run} />
                            <WeightPlanSettings data={data} />
                            <QuotePanel quotes={data.quotes} run={run} />
                            <Achievement
                              training={data.training}
                              data={data}
                              today={today}
                              onRecord={() => open("薄肌")}
                              onActiveChange={setSharingOpen}
                            />
                            <SettingsExtras
                              style={normalizeStyle(data.profile?.style)}
                              onActiveChange={setSharingOpen}
                            />
                            {lean && (
                              <>
                                <AppearanceSettings
                                  mode={mode}
                                  setMode={setMode}
                                  notice={notice}
                                />
                              </>
                            )}
                            <BackupPanel run={run} />
                            <ProtectionPanel run={run} />
                          </>
                        )}
                        <InstallPanel cacheReady={cacheReady} />
                        <ResetPanel
                          run={run}
                          onReset={() => window.location.reload()}
                        />
                        <p className="quiet" data-testid="app-version">
                          薄肌 LEAN · v{APP_VERSION}
                        </p>
                        <p className="starter-attribution">
                          个人非商业部署 · 非官方版本
                          <br />
                          <a
                            href={SOURCE_REPOSITORY_URL}
                            target="_blank"
                            rel="noreferrer"
                          >
                            基于薄肌 LEAN · 查看来源与许可
                          </a>
                        </p>
                      </div>
                    )}
                  </>
                ))}
            </div>
          </main>
          <nav
            inert={onboarding}
            style={
              {
                "--tab": tabs.findIndex((t) => t.name === page),
              } as React.CSSProperties
            }
            className="bottom-nav"
            aria-label="主导航"
          >
            {tabs.map(({ name, icon: Icon }) => (
              <button
                key={name}
                aria-current={page === name ? "page" : undefined}
                onClick={() => {
                  setMessage("");
                  setPhotoView(false);
                  document.documentElement.style.setProperty(
                    "--slide-direction",
                    String(
                      tabs.findIndex((t) => t.name === name) >=
                        tabs.findIndex((t) => t.name === page)
                        ? 1
                        : -1,
                    ),
                  );
                  setPage(name);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
              >
                <Icon size={21} strokeWidth={1.7} />
                <span>{name}</span>
              </button>
            ))}
          </nav>
          {editor && loaded && (
            <RecordEditor
              key={editor.kind + editor.date}
              {...editor}
              data={data}
              run={run}
              onClose={() => setEditor(null)}
            />
          )}
        </div>
      </MuscleProvider>
    </UnitProvider>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  unit,
  text,
  color,
  disabled,
  onClick,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  unit: string;
  text: string;
  color: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={"metric metric-button " + color}
      aria-label={"记录" + label}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="metric-label">
        <Icon size={20} />
        <span>{label}</span>
      </div>
      {value !== "" && (
        <div
          className={
            "metric-value " +
            (label === "薄肌" || label === "马甲线" ? "training-value" : "")
          }
        >
          {value}
          {unit && <small>{unit}</small>}
        </div>
      )}
      <p>{text}</p>
      <ChevronRight size={20} className="entry-chevron" />
    </button>
  );
}

function AppearanceSettings({
  mode,
  setMode,
  notice,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  notice: string;
}) {
  return (
    <section className="settings">
      <div className="section-heading">
        <h2>外观</h2>
      </div>
      <div className="theme-options">
        {(
          [
            { id: "light", label: "浅色", icon: Sun },
            { id: "dark", label: "深色", icon: Moon },
            {
              id: "system",
              label: "跟随系统",
              icon: Monitor,
            },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
            {mode === id && <Check size={16} />}
          </button>
        ))}
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
