import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Disclosure } from "./FoldSection";
it("连续反向展开由最终状态决定且箭头始终独立存在", () => {
  render(
    <Disclosure>
      <summary>明细</summary>
      <p>内容</p>
    </Disclosure>,
  );
  const b = screen.getByRole("button", { name: "明细" });
  for (let i = 0; i < 25; i++) fireEvent.click(b);
  expect(b).toHaveAttribute("aria-expanded", "true");
  expect(b.querySelector("svg")).toBeInTheDocument();
  for (let i = 0; i < 24; i++) fireEvent.click(b);
  expect(b).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(b);
  expect(b).toHaveAttribute("aria-expanded", "false");
  expect(b.querySelector("svg")).toBeInTheDocument();
});
it("未展开月份不挂载照片，展开后保留内容以完成关闭动画", () => {
  render(
    <Disclosure lazy>
      <summary>十月</summary>
      <p>照片内容</p>
    </Disclosure>,
  );
  expect(screen.queryByText("照片内容")).not.toBeInTheDocument();
  const b = screen.getByRole("button", { name: "十月" });
  fireEvent.click(b);
  expect(screen.getByText("照片内容")).toBeInTheDocument();
  fireEvent.click(b);
  expect(screen.getByText("照片内容")).toBeInTheDocument();
  expect(document.querySelector(".disclosure-grid")).toHaveAttribute("inert");
});
