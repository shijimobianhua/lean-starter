import { describe, it, expect } from "vitest";
import { resolveProductUrl, SOURCE_REPOSITORY_URL } from "./share-config";
describe("个人部署分享回流", () => {
  it("未配置时指向当前独立站点", () => {
    expect(resolveProductUrl(undefined, "https://my-personal.example")).toBe(
      "https://my-personal.example/",
    );
  });
  it("正式网址显式配置优先且结果规范化", () => {
    expect(
      resolveProductUrl("https://my-own.example/", "https://preview.example"),
    ).toBe("https://my-own.example/");
  });
  it("本机开发允许HTTP，公网HTTP和凭据/路径/查询均拒绝", () => {
    expect(resolveProductUrl(undefined, "http://127.0.0.1:4165")).toBe(
      "http://127.0.0.1:4165/",
    );
    for (const input of [
      "http://public.example/",
      "https://user:pass@private.example/",
      "https://my-own.example/sub/",
      "https://my-own.example/?x=1",
      "javascript:alert(1)",
    ])
      expect(() => resolveProductUrl(input)).toThrow();
  });
  it("来源链接是源码仓库，不是部署权限", () => {
    expect(SOURCE_REPOSITORY_URL).toBe(
      "https://github.com/shijimobianhua/lean-starter",
    );
  });
});
