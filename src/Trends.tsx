import { WorkoutStats } from "./WorkoutStats";
import { useViewState, useHasViewState } from "./view-state";
import { Disclosure } from "./FoldSection";
import { useWeightUnit } from "./units";
import { toDisplay, displayWeight } from "./domain";
import { usePageSwipe } from "./eighth-interaction";
import { weightDomain, trendDomain, bmiDomain } from "./chart-scale";
import { useMuscle } from "./Onboarding";
import { useState, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { localDate, trendRows, type Snapshot } from "./records";
import { Photos } from "./Photos";
import type { Run } from "./RecordForms";
import { Modal } from "./Modal";
import { Expand } from "lucide-react";
const ranges = [7, 30, 90, 365, 0];
type Rows = ReturnType<typeof trendRows>;
function Range({
  value,
  onChange,
  label = "趋势日期范围",
}: {
  value: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {ranges.map((n) => (
        <option key={n} value={n}>
          {n ? "近 " + n + " 天" : "全部记录"}
        </option>
      ))}
    </select>
  );
}
function Chart({
  kind,
  rows,
  bmi,
  wide = false,
  heightCm,
}: {
  kind: string;
  rows: Rows;
  bmi: boolean;
  wide?: boolean;
  heightCm?: number;
}) {
  const weightUnit = useWeightUnit();
  const shown = rows.map((r) => ({
    ...r,
    value: kind === "体重" ? displayWeight(r.value, weightUnit) : r.value,
  }));
  const unit = kind === "体重" ? weightUnit : kind === "大睡" ? "小时" : "ml";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={shown}
        margin={{ top: 18, right: 10, left: 0, bottom: 8 }}
        accessibilityLayer
      >
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          minTickGap={wide ? 35 : 24}
          tickFormatter={(s) => (wide ? String(s) : String(s).slice(5))}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
        />
        <YAxis
          yAxisId="primary"
          domain={
            kind === "体重"
              ? weightDomain(rows.map((r) => r.value)).map((v) =>
                  toDisplay(v, weightUnit),
                )
              : trendDomain(
                  kind,
                  rows.map((r) => r.value),
                )
          }
          width={45}
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          label={{
            value: unit,
            position: "insideTopLeft",
            fill: "var(--muted)",
            fontSize: 10,
          }}
        />
        {bmi && (
          <YAxis
            yAxisId="bmi"
            orientation="right"
            domain={bmiDomain(
              rows.map((r) => r.value),
              heightCm ?? 175,
            )}
            tickFormatter={(n: number) => n.toFixed(1)}
            width={42}
            tick={{ fontSize: 11, fill: "var(--chart-secondary)" }}
            label={{
              value: "BMI",
              position: "insideTopRight",
              fill: "var(--chart-secondary)",
              fontSize: 10,
            }}
          />
        )}
        {!wide && (
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <time>{String(label)}</time>
                  {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }}>
                      {p.name}：
                      {typeof p.value === "number"
                        ? Number(p.value.toFixed(2))
                        : String(p.value)}
                    </p>
                  ))}
                </div>
              ) : null
            }
          />
        )}
        <Line
          yAxisId="primary"
          name={kind + "（" + unit + "）"}
          dataKey="value"
          type="linear"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={rows.length < 40 ? { r: 3 } : false}
          isAnimationActive={false}
        />
        {bmi && (
          <Line
            yAxisId="bmi"
            name="BMI"
            dataKey="bmi"
            type="linear"
            stroke="var(--chart-secondary)"
            strokeDasharray="5 4"
            strokeWidth={2}
            dot={rows.length < 40 ? { r: 3 } : false}
            isAnimationActive={false}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
function WideTrends({
  kind,
  data,
  initialBmi,
  onClose,
}: {
  kind: string;
  data: Snapshot;
  initialBmi: boolean;
  onClose: () => void;
}) {
  const weightUnit = useWeightUnit();
  const [days, setDays] = useViewState("trends.wide.days", 0),
    [bmi, setBmi] = useViewState("trends.wide.bmi", initialBmi),
    [detail, setDetail] = useViewState("trends.wide.detail", false);
  const rows = trendRows(kind, data, days),
    showBmi = kind === "体重" && bmi && !!data.profile?.heightCm;
  return (
    <Modal
      title={kind + " · 横向趋势"}
      className="wide-viewer"
      onClose={onClose}
    >
      <div className="wide-controls">
        <div className="range-pills" aria-label="横向趋势日期范围">
          {ranges.map((n) => (
            <button
              key={n}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {n ? n + "天" : "全部"}
            </button>
          ))}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={detail}
            onChange={(e) => setDetail(e.target.checked)}
          />
          详细排布
        </label>
        {kind === "体重" && data.profile?.heightCm && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={bmi}
              onChange={(e) => setBmi(e.target.checked)}
            />
            显示 BMI
          </label>
        )}
        <span>{rows.length} 天记录</span>
      </div>
      <div className="wide-unit-legend">
        <span>
          — {kind}（
          {kind === "体重" ? weightUnit : kind === "大睡" ? "小时" : "ml"}）
        </span>
        {showBmi && <span>┄ BMI</span>}
      </div>
      <div className="wide-chart-scroll">
        <div
          className="wide-chart"
          style={{
            width: detail
              ? "max(100%, " +
                Math.min(24000, Math.max(600, rows.length * 14)) +
                "px)"
              : "100%",
          }}
        >
          {rows.length ? (
            <Chart
              kind={kind}
              rows={rows}
              bmi={showBmi}
              heightCm={data.profile?.heightCm}
              wide
            />
          ) : (
            <div className="empty">此范围暂无记录</div>
          )}
        </div>
      </div>
      <p className="wide-caption">
        {rows.length
          ? rows[0].date + " — " + rows[rows.length - 1].date
          : "暂无日期"}{" "}
        · 薄肌 LEAN ·{" "}
        {showBmi ? "左轴体重 " + weightUnit + " / 右轴 BMI" : "仅真实记录"}
      </p>
    </Modal>
  );
}
export function Trends({
  data,
  run,
  onHeight,
}: {
  data: Snapshot;
  run: Run;
  onHeight: () => void;
}) {
  const muscle = useMuscle(),
    weightUnit = useWeightUnit();
  const [resumed] = useState(useHasViewState("trends.kind"));
  const navigated = useRef(false);
  const [kind, rememberKind] = useViewState("trends.kind", "体重"),
    [days, setDays] = useViewState("trends.days", 30),
    [showBmi, setShowBmi] = useViewState("trends.bmi", false),
    [wide, setWide] = useState(false);
  const setKind = (value: string) => {
    navigated.current = true;
    rememberKind(value);
  };
  const categories = ["体重", "大睡", "大水", "薄肌"];
  const swipe = usePageSwipe(categories.indexOf(kind), 4, (i) => {
    document.documentElement.style.setProperty(
      "--slide-direction",
      String(i >= categories.indexOf(kind) ? 1 : -1),
    );
    setKind(categories[i]);
  });
  const rows = trendRows(kind, data, days),
    unit = kind === "体重" ? weightUnit : kind === "大睡" ? "小时" : "ml",
    hasHeight = !!data.profile?.heightCm,
    bmiVisible = kind === "体重" && showBmi && hasHeight,
    average = rows.length
      ? rows.reduce((a, r) => a + r.value, 0) / rows.length
      : 0;
  return (
    <section className="trend-swipe" {...swipe}>
      <div className="segments" aria-label="趋势分类">
        {["体重", "大睡", "大水", "薄肌"].map((c) => (
          <button
            key={c === "薄肌" ? muscle : c}
            aria-pressed={kind === c}
            onClick={() => setKind(c)}
          >
            {c === "薄肌" ? muscle : c}
          </button>
        ))}
      </div>
      <div
        className="trend-stage"
        key={kind}
        data-restored={resumed && !navigated.current}
      >
        {kind === "薄肌" ? (
          <>
            {data.profile?.style === "lean" && (
              <WorkoutStats
                data={data}
                selected={localDate()}
                month={localDate().slice(0, 7)}
              />
            )}
            <Photos photos={data.photos} run={run} />
          </>
        ) : (
          <>
            <div className="section-heading trend-heading">
              <h2>{kind}趋势</h2>
              <Range value={days} onChange={setDays} />
              <button
                className="small-button wide-entry"
                onClick={() => setWide(true)}
              >
                <Expand size={16} />
                横向查看
              </button>
            </div>
            {kind === "体重" && (
              <div className="bmi-controls">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={showBmi && hasHeight}
                    disabled={!hasHeight}
                    onChange={(e) => setShowBmi(e.target.checked)}
                  />
                  显示 BMI
                </label>
                {hasHeight ? (
                  <span>按当前身高 {data.profile?.heightCm} cm 计算</span>
                ) : (
                  <button className="text-button" onClick={onHeight}>
                    填写身高后可查看 BMI
                  </button>
                )}
              </div>
            )}
            {rows.length ? (
              <section className="panel">
                <div className="trend-summary">
                  <div>
                    <small>记录均值</small>
                    <strong>
                      {(kind === "体重"
                        ? toDisplay(average, weightUnit)
                        : average
                      ).toFixed(1)}{" "}
                      <small>{unit}</small>
                    </strong>
                  </div>
                  <span>
                    {rows.length} 天有记录{days ? " / " + days + " 天" : ""}
                  </span>
                </div>
                {kind === "大水" && (
                  <p className="hint">
                    平均 {(average / 1500).toFixed(2)} 大水 · 1 大水 = 1500ml
                  </p>
                )}
                <div
                  className="chart"
                  aria-label={
                    bmiVisible ? "体重与BMI曲线" : "仅" + kind + "曲线"
                  }
                >
                  <Chart
                    kind={kind}
                    rows={rows}
                    bmi={bmiVisible}
                    heightCm={data.profile?.heightCm}
                  />
                </div>

                <div className="chart-legend">
                  <span>
                    — {kind}（{unit}）
                  </span>
                  {bmiVisible && <span>┄ BMI</span>}
                </div>
                <Disclosure memoryKey={"trends.details:" + kind}>
                  <summary>查看数据明细</summary>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>
                            {kind}（{unit}）
                          </th>
                          {bmiVisible && <th>BMI</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.date}>
                            <td>{r.date}</td>
                            <td>
                              {kind === "体重"
                                ? displayWeight(r.value, weightUnit)
                                : r.value}
                              {kind === "大水"
                                ? " / " + (r.value / 1500).toFixed(2) + " 大水"
                                : ""}
                            </td>
                            {bmiVisible && <td>{r.bmi}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Disclosure>
              </section>
            ) : (
              <section className="empty">
                <h2>这段时间还没有{kind}记录</h2>
                <p>从首页卡片或日历补记后查看。</p>
              </section>
            )}
            {wide && (
              <WideTrends
                kind={kind}
                data={data}
                initialBmi={bmiVisible}
                onClose={() => setWide(false)}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
