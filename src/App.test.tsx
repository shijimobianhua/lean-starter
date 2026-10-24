import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";
import { db } from "./data";
import { localDate, shiftDate } from "./records";
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.profile.put({ id: "local", gender: "male", onboardingDone: true });
});
async function open(kind: string) {
  const button = await screen.findByRole("button", { name: "记录" + kind });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.getByRole("dialog");
}
describe("第三次更新流程", () => {
  it("四卡可记录，导航为今天趋势日历我的", async () => {
    render(<App />);
    for (const kind of ["大水", "大睡", "薄肌", "体重"]) {
      const dialog = await open(kind);
      expect(
        within(dialog).getByRole("heading", { name: kind + "记录" }),
      ).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "关闭记录" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "日历" }));
    expect(await screen.findByLabelText("记录日历")).toBeInTheDocument();
    expect(screen.queryByLabelText("体重（kg）")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "趋势" }));
    for (const name of ["体重", "大睡", "大水", "薄肌"])
      expect(
        await screen.findByRole("button", { name }, { timeout: 5000 }),
      ).toBeInTheDocument();
  });
  it("主题持久化并恢复", async () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "我的" }));
    fireEvent.click(await screen.findByRole("button", { name: "深色" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("form-theme")).toBe("dark");
    first.unmount();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("system模式跟随系统并清理监听", () => {
    let listener = () => {};
    const mq = {
      matches: false,
      addEventListener: vi.fn((_name: string, cb: () => void) => {
        listener = cb;
      }),
      removeEventListener: vi.fn(),
    };
    vi.mocked(window.matchMedia).mockImplementation((query) =>
      query === "(prefers-color-scheme: dark)"
        ? (mq as unknown as MediaQueryList)
        : ({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          } as unknown as MediaQueryList),
    );
    const view = render(<App />);
    mq.matches = true;
    listener();
    expect(document.documentElement.dataset.theme).toBe("dark");
    view.unmount();
    expect(mq.removeEventListener).toHaveBeenCalled();
  });
  it("偏好无法写入时仍可切换", async () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw Error("unavailable");
      });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "我的" }));
    fireEvent.click(await screen.findByRole("button", { name: "浅色" }));
    expect(screen.getByRole("status")).toHaveTextContent("暂时无法保存");
    spy.mockRestore();
  });
  it("首页体重记录保存并回显", async () => {
    render(<App />);
    const dialog = await open("体重");
    fireEvent.change(within(dialog).getByLabelText("体重（kg）"), {
      target: { value: "64.2" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存体重" }));
    expect(await screen.findByRole("status")).toHaveTextContent("体重已保存");
    expect(await screen.findByText("64.2")).toBeInTheDocument();
  });
  it("失败保留输入并可重试", async () => {
    render(<App />);
    const dialog = await open("体重"),
      field = within(dialog).getByLabelText("体重（kg）");
    fireEvent.change(field, { target: { value: "64.2" } });
    const spy = vi
      .spyOn(db.weights, "put")
      .mockRejectedValueOnce(Error("空间不足"));
    fireEvent.click(within(dialog).getByRole("button", { name: "保存体重" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "空间不足",
    );
    expect(field).toHaveValue(64.2);
    spy.mockRestore();
    fireEvent.click(within(dialog).getByRole("button", { name: "保存体重" }));
    expect(await screen.findByRole("status")).toHaveTextContent("体重已保存");
  });
  it("大水实时换算、撤销和减少不为负", async () => {
    render(<App />);
    const dialog = await open("大水");
    fireEvent.click(within(dialog).getByRole("button", { name: "+0.2 大水" }));
    expect(dialog).toHaveTextContent("300 ml");
    fireEvent.click(within(dialog).getByRole("button", { name: "撤销上一步" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "+0.1 大水" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "-0.1 大水" }));
    expect(
      within(dialog).getByRole("button", { name: "-0.1 大水" }),
    ).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "中午" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "+0.5 大水" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "保存大水" }));
    await screen.findByRole("status");
    expect((await db.water.get(localDate()))?.noonMl).toBe(750);
  });
  it("大睡只选时分，自动跨午夜", async () => {
    render(<App />);
    const dialog = await open("大睡");
    fireEvent.change(within(dialog).getByLabelText("入睡时分"), {
      target: { value: "23:30" },
    });
    fireEvent.change(within(dialog).getByLabelText("起床时分"), {
      target: { value: "07:30" },
    });
    expect(dialog).toHaveTextContent("共 8.0 小时");
    expect(
      within(dialog).queryByDisplayValue(localDate()),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "保存大睡" }));
    await screen.findByRole("status");
    expect(await db.sleep.get(localDate())).toBeDefined();
  });
  it("主动确认休息与未记录区分", async () => {
    render(<App />);
    const dialog = await open("薄肌");
    fireEvent.click(within(dialog).getByRole("button", { name: "今日休息" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "保存薄肌" }));
    await screen.findByRole("status");
    expect((await db.training.get(localDate()))?.status).toBe("rest");
    expect(await screen.findByText("今日休息")).toBeInTheDocument();
  });
  it("日历选日补记归到所选日期", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "记录体重" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "日历" }));
    const yesterday = shiftDate(localDate(), -1);
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp("^" + yesterday + " ") }),
    );
    const detail = screen.getByLabelText("所选日期详情");
    fireEvent.click(within(detail).getByRole("button", { name: /体重/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("体重（kg）"), {
      target: { value: "66" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存体重" }));
    await screen.findByRole("status");
    expect((await db.weights.get(yesterday))?.weightKg).toBe(66);
    expect(await db.weights.get(localDate())).toBeUndefined();
  });
});
