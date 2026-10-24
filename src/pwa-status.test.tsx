import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({
  update: vi.fn(async () => {}),
  refresh: true,
}));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [state.refresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: state.update,
  }),
}));
import { PwaStatus } from "./pwa";
it("更新按钮可见可点击，打开记录时隐藏，确认后才更新", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const v = render(<PwaStatus />);
  const b = screen.getByRole("button", { name: "新版本已就绪，点击更新" });
  fireEvent.click(b);
  expect(state.update).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(b);
  await waitFor(() => expect(state.update).toHaveBeenCalledWith(true));
  v.rerender(<PwaStatus blocked />);
  expect(
    screen.queryByRole("button", { name: "新版本已就绪，点击更新" }),
  ).not.toBeInTheDocument();
  confirm.mockRestore();
});

import { db } from "./data";
import { recoveryDb } from "./recovery";
it("更新前副本写入失败会阻止刷新而不清除已有数据", async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.weights.put({
    date: "2026-10-18",
    weightKg: 75,
    updatedAt: new Date().toISOString(),
  });
  state.update.mockClear();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true),
    put = vi
      .spyOn(recoveryDb.checkpoints, "put")
      .mockRejectedValueOnce(Error("空间不足"));
  render(<PwaStatus />);
  fireEvent.click(
    screen.getByRole("button", { name: "新版本已就绪，点击更新" }),
  );
  await screen.findByText(/更新已暂停/);
  expect(state.update).not.toHaveBeenCalled();
  expect(await db.weights.count()).toBe(1);
  put.mockRestore();
  confirm.mockRestore();
});
