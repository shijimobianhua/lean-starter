import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InstallPanel } from "./InstallPanel";
import { startInstallCapture } from "./install";
it("安装入口始终存在，支持事件时触发系统安装，安装后更新状态", async () => {
  const stop = startInstallCapture(),
    view = render(<InstallPanel cacheReady />);
  fireEvent.click(screen.getByRole("button", { name: "安装到电脑" }));
  expect(screen.getByRole("heading", { name: "安装指引" })).toBeInTheDocument();
  view.unmount();
  const ua = vi
    .spyOn(navigator, "userAgent", "get")
    .mockReturnValue("Mozilla Android Chrome");
  render(<InstallPanel cacheReady />);
  const prompt = vi.fn(async () => {}),
    event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  window.dispatchEvent(event);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "安装到手机" }),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "安装到手机" }));
  await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "已安装" })).toBeDisabled(),
  );
  stop();
  ua.mockRestore();
});
