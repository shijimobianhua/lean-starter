import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Photos, preparePhoto } from "./Photos";
import type { PhotoEntry } from "./data";
describe("照片交互", () => {
  it("两张照片按日期对比并清理对象URL", () => {
    const create = vi.fn(() => "blob:test-" + Math.random()),
      revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: create,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: revoke,
    });
    const photos: PhotoEntry[] = [
      {
        id: "b",
        date: "2026-10-17",
        createdAt: "2026-10-17T00:00:00Z",
        image: new Blob(["b"], { type: "image/jpeg" }),
      },
      {
        id: "a",
        date: "2026-10-01",
        createdAt: "2026-10-01T00:00:00Z",
        image: new Blob(["a"], { type: "image/jpeg" }),
      },
    ];
    const view = render(<Photos photos={photos} run={vi.fn()} />);
    fireEvent.click(screen.getByRole("button",{name:"照片对比"}));
    fireEvent.click(screen.getByRole("button",{name:/选择对比 2026-10-17/}));
    fireEvent.change(screen.getByLabelText("选择照片日期"),{target:{value:"2026-10-01"}});
    fireEvent.click(screen.getByRole("button",{name:/选择对比 2026-10-01/}));
    fireEvent.click(screen.getByRole("button",{name:/开始对比/}));
    const images = within(screen.getByRole("dialog")).getAllByRole("img");
    expect(images[0]).toHaveAttribute("alt", "照片记录 2026-10-01");
    expect(images[1]).toHaveAttribute("alt", "照片记录 2026-10-17");
    view.unmount();
    expect(revoke).toHaveBeenCalledTimes(create.mock.calls.length);
  });
  it("无效文件与超大图片在解码前被拒绝", async () => {
    await expect(
      preparePhoto(new File(["text"], "x.txt", { type: "text/plain" })),
    ).rejects.toThrow("JPG");
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 16 * 1024 * 1024 });
    await expect(preparePhoto(big)).rejects.toThrow("15MB");
  });
});
