import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { it, expect } from "vitest";
import App from "./App";
import { db } from "./data";
import { saveSleep, localDate, shiftDate, sleepHours } from "./records";
it("旧版多日大睡在未修改时保存保持原时间戳", async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.profile.put({ id: "local", gender: "male", onboardingDone: true });
  const original = await saveSleep(
    shiftDate(localDate(), -2) + "T23:30",
    localDate() + "T07:30",
  );
  render(<App />);
  const button = await screen.findByRole("button", { name: "记录大睡" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("共 32.0 小时");
  fireEvent.click(within(dialog).getByRole("button", { name: "保存大睡" }));
  await screen.findByRole("status");
  const saved = await db.sleep.get(localDate());
  expect(saved?.startAt).toBe(original.startAt);
  expect(saved?.endAt).toBe(original.endAt);
  expect(sleepHours(saved!)).toBe(32);
});
