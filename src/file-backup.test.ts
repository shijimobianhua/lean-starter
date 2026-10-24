import { it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  settings: new Map<string, unknown>(),
  payload: { app: "FORM DAILY" },
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock("./recovery", () => ({
  getSetting: (id: string) => Promise.resolve(mocks.settings.get(id)),
  setSetting: async (id: string, value: unknown) => {
    mocks.settings.set(id, value);
  },
}));
vi.mock("./backup", () => ({
  exportBackup: async () => mocks.payload,
  serializeSnapshot: async () => mocks.payload,
}));
import {
  writeFolderBackup,
  disconnectFolder,
  reconnectFolder,
} from "./file-backup";
beforeEach(() => {
  mocks.settings.clear();
});
it("授权文件夹按日写独立文件，成功关闭且断开不会删除文件", async () => {
  const write = vi.fn(),
    close = vi.fn(),
    abort = vi.fn(),
    get = vi.fn(async (_name: string) => ({
      createWritable: async () => ({ write, close, abort }),
    }));
  mocks.settings.set("backup-directory", {
    name: "my folder",
    queryPermission: async () => "granted",
    getFileHandle: get,
  });
  await writeFolderBackup();
  expect(get.mock.calls[0][0]).toMatch(
    /^薄肌-LEAN-\d{4}-\d{2}-\d{2}-[\da-f]{8}-[\da-f]{8}\.json$/,
  );
  expect(write).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(abort).not.toHaveBeenCalled();
  const status = mocks.settings.get("folder-backup-status") as {
    error: string;
  };
  expect(status.error).toBe("");
  await disconnectFolder();
  expect(mocks.settings.get("backup-directory")).toBeUndefined();
});
it("权限失效不写入，重新授权后可恢复备份", async () => {
  let permission = "prompt";
  const write = vi.fn();
  const get = vi.fn(async (_name: string) => ({
    createWritable: async () => ({ write, close: async () => {} }),
  }));
  mocks.settings.set("backup-directory", {
    name: "folder",
    queryPermission: async () => permission,
    requestPermission: async () => {
      permission = "granted";
      return permission;
    },
    getFileHandle: get,
  });
  await expect(writeFolderBackup()).rejects.toThrow("重新授权");
  expect(get).not.toHaveBeenCalled();
  await reconnectFolder();
  expect(write).toHaveBeenCalledOnce();
});
it("写入失败时中止原子文件流并报告失败", async () => {
  const abort = vi.fn(),
    close = vi.fn();
  mocks.settings.set("backup-directory", {
    name: "folder",
    queryPermission: async () => "granted",
    getFileHandle: async () => ({
      createWritable: async () => ({
        write: async () => {
          throw Error("磁盘已满");
        },
        close,
        abort,
      }),
    }),
  });
  await expect(writeFolderBackup()).rejects.toThrow("磁盘已满");
  expect(abort).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
  expect(
    (mocks.settings.get("folder-backup-status") as { error: string }).error,
  ).toBe("磁盘已满");
});
