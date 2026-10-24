import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { TextEncoder as NodeTextEncoder } from "node:util";
import { recoveryDb } from "./recovery";
import { Blob as NodeBlob } from "node:buffer";
import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(async () => {
  cleanup();
  localStorage.clear();
  await Promise.all(recoveryDb.tables.map(t=>t.clear()));
});
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

vi.stubGlobal("Blob", NodeBlob);

window.scrollTo = vi.fn();

Object.defineProperty(globalThis.crypto,"subtle",{value:webcrypto.subtle,configurable:true});
vi.stubGlobal("TextEncoder",NodeTextEncoder);
