import { it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewStateProvider, useViewState } from "./view-state";
import { HomeStack } from "./WeightPlan";
import { Disclosure } from "./FoldSection";
import { emptyData, localDate } from "./records";
import { APP_VERSION } from "./version";
import { APP_VERSION as recoveryVersion } from "./recovery";
import { SettingsExtras } from "./SettingsExtras";
import { version } from "../package.json";

function Choice() {
  const [v, set] = useViewState("example.choice", 0);
  return (
    <button
      onClick={() => {
        set((x) => x + 1);
        set((x) => x + 1);
      }}
    >
      {v}
    </button>
  );
}
it("查看状态跨子页卸载保留，连续更新正确，但不跨应用重启或写存储", () => {
  const write = vi.spyOn(Storage.prototype, "setItem");
  const wrapper = (visible: boolean) => (
    <ViewStateProvider>{visible && <Choice />}</ViewStateProvider>
  );
  const view = render(wrapper(true));
  fireEvent.click(screen.getByRole("button", { name: "0" }));
  expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
  view.rerender(wrapper(false));
  view.rerender(wrapper(true));
  expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  view.unmount();
  render(wrapper(true));
  expect(screen.getByRole("button", { name: "0" })).toBeInTheDocument();
  write.mockRestore();
});
it("卡片按稳定名称恢复；重排不串卡，方案删除后回退有效卡片", () => {
  const data = {
    ...emptyData,
    profile: {
      id: "local",
      weightPlan: {
        id: "p",
        startKg: 75,
        targetKg: 65,
        startDate: "2026-01-01",
        targetDate: "2027-01-01",
      },
      widgets: ["quote", "weight"] as ("quote" | "weight")[],
    },
  };
  const wrapper = (show: boolean, d = data) => (
    <ViewStateProvider>
      {show && <HomeStack data={d} today={localDate()} />}
    </ViewStateProvider>
  );
  const view = render(wrapper(true));
  fireEvent.click(screen.getByRole("button", { name: "显示体重进度" }));
  view.rerender(wrapper(false));
  view.rerender(
    wrapper(true, {
      ...data,
      profile: { ...data.profile, widgets: ["weight", "quote"] },
    }),
  );
  expect(screen.getByRole("button", { name: "显示体重进度" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  view.rerender(
    <ViewStateProvider>
      <HomeStack data={emptyData} today={localDate()} />
    </ViewStateProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "显示体重进度" }),
  ).not.toBeInTheDocument();
  view.rerender(wrapper(true));
  expect(screen.getByRole("button", { name: "显示每日一句" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("有记忆键的查看折叠恢复，没有记忆键的临时内容不恢复", () => {
  const wrapper = (show: boolean) => (
    <ViewStateProvider>
      {show && (
        <>
          <Disclosure memoryKey="table">
            <summary>数据明细</summary>
            <p>记录</p>
          </Disclosure>
          <Disclosure>
            <summary>临时说明</summary>
            <p>说明</p>
          </Disclosure>
        </>
      )}
    </ViewStateProvider>
  );
  const view = render(wrapper(true));
  fireEvent.click(screen.getByRole("button", { name: "数据明细" }));
  fireEvent.click(screen.getByRole("button", { name: "临时说明" }));
  view.rerender(wrapper(false));
  view.rerender(wrapper(true));
  expect(screen.getByRole("button", { name: "数据明细" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByRole("button", { name: "临时说明" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
it("当前版本来自包版本，恢复副本同源且产品不再显示更新日志", () => {
  expect(APP_VERSION).toBe(version);
  expect(recoveryVersion).toBe(version);
  render(<SettingsExtras />);
  expect(screen.queryByRole("button", {name:"更新日志"})).not.toBeInTheDocument();
  expect(screen.getByRole("button", {name:/风格选择/})).toBeInTheDocument();
});
