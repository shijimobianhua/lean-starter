export const SOURCE_REPOSITORY_URL =
  "https://github.com/shijimobianhua/lean-starter";
export const PRODUCT_NAME = "薄肌 LEAN";
/** No production identity is copied. A configured canonical URL is optional. */
export function resolveProductUrl(
  configured?: string,
  currentOrigin?: string,
): string {
  const raw = configured?.trim() || currentOrigin || "http://localhost:5173";
  const url = new URL(raw);
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  )
    throw new Error(
      "分享网址应为无账号密码的 HTTPS 地址；仅本机开发允许 HTTP。",
    );
  if (url.pathname !== "/" || url.search || url.hash)
    throw new Error(
      "当前模板使用根路径部署，正式网址只填写域名，不附加路径、查询或片段。",
    );
  return url.origin + "/";
}
export const PRODUCT_URL = resolveProductUrl(
  import.meta.env.VITE_PUBLIC_APP_URL,
  typeof window !== "undefined" && window.location.origin !== "null"
    ? window.location.origin
    : undefined,
);
