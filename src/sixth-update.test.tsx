import { ConfirmHost } from "./confirm";
import { beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { db } from "./data";
import { QuotePanel } from "./QuotePanel";
import {
  builtinQuotes,
  normalizeQuoteText,
  saveQuote,
  removeQuote,
  ensureDailyQuote,
} from "./quotes";
import { freezeBackground, safeViewport, motion } from "./viewport";
import { localDate } from "./records";
import { exportBackup, importBackup } from "./backup";
const run = async (fn: () => Promise<unknown>) => {
  await fn();
  return true;
};
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  vi.restoreAllMocks();
});
it("公开示例句库60句有来源且支持中英排版", () => {
  expect(builtinQuotes).toHaveLength(60);
  expect(
    builtinQuotes.every((q) => q.source === "Lean Starter · 示例短句"),
  ).toBe(true);
  for (const q of builtinQuotes) {
    expect(q.text).toBe(normalizeQuoteText(q.text));
    if (q.language === "en") {
      expect(q.translation).toBeTruthy();
      expect(q.text).not.toMatch(/[\u200B\u00A0\n]/);
    }
  }
});
it("规范粘贴空格、换行与零宽空格，保留句子标点", () => {
  expect(normalizeQuoteText("  Trust\u00a0  thyself.\n")).toBe(
    "Trust thyself.",
  );
  expect(normalizeQuoteText("你\u200b好。")).toBe("你好。");
});
it("更新句库不覆盖内置编辑、删除、自定义、当天快照或旧备份", async () => {
  await saveQuote(
    { text: "用户的覆盖", translation: "", source: "我", language: "zh" },
    "builtin-2",
  );
  await removeQuote("builtin-3");
  await saveQuote({
    text: "自己的句子",
    translation: "",
    source: "我",
    language: "zh",
  });
  await db.dailyQuotes.put({
    date: localDate(),
    text: "当天保持",
    translation: "",
    source: "FORM DAILY · 原创",
    language: "zh",
  });
  const b = await exportBackup();
  delete b.integrity;
  await Promise.all(db.tables.map((t) => t.clear()));
  await importBackup(b);
  expect((await ensureDailyQuote())?.text).toBe("当天保持");
  expect((await db.profile.get("local"))?.hiddenQuotes).toContain("builtin-3");
  expect((await db.quotes.get("builtin-2"))?.text).toBe("用户的覆盖");
  expect(await db.quotes.count()).toBe(2);
});
it("每日一句在独立弹窗管理，未保存退出可以取消", async () => {
  render(
    <>
      <ConfirmHost />
      <QuotePanel quotes={[]} run={run} />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: /每日一句/ }));
  const d = screen.getByRole("dialog");
  expect(d).toHaveAccessibleName("每日一句");
  fireEvent.click(within(d).getByRole("button", { name: "新增句子" }));
  fireEvent.change(within(d).getByLabelText("句子正文"), {
    target: { value: "草稿" },
  });
  fireEvent.click(within(d).getByRole("button", { name: "关闭浮窗" }));
  await waitFor(() =>
    expect(screen.getByRole("dialog", { name: "请确认" })).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(within(d).getByLabelText("句子正文")).toHaveValue("草稿");
  await waitFor(
    () =>
      expect(
        screen.queryByRole("dialog", { name: "请确认" }),
      ).not.toBeInTheDocument(),
    { timeout: 2000 },
  );
  fireEvent.click(within(d).getByRole("button", { name: "关闭浮窗" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "放弃修改" }),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "放弃修改" }));
  await waitFor(
    () => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    { timeout: 2500 },
  );
});
it("背景导航冻结支持嵌套且解除后清理", () => {
  const first = freezeBackground(),
    second = freezeBackground();
  expect(document.documentElement.dataset.modalOpen).toBe("true");
  first();
  expect(document.documentElement.dataset.modalOpen).toBe("true");
  second();
  expect(document.documentElement.dataset.modalOpen).toBeUndefined();
  expect(
    document.documentElement.style.getPropertyValue("--frozen-nav-top"),
  ).toBe("");
  expect(motion.close).toBe(550);
});
it("安全区域计算为横向布局提供完整可用区域", () => {
  expect(safeViewport(390, 844, 75, 34)).toEqual({
    x: 12,
    y: 87,
    width: 366,
    height: 711,
  });
  expect(safeViewport(844, 390, 0, 21, 59, 0)).toEqual({
    x: 71,
    y: 12,
    width: 761,
    height: 345,
  });
});
