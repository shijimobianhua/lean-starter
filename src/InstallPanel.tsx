import {Disclosure} from "./FoldSection";
import { useState } from "react";
import { useInstall, promptInstall } from "./install";
export function InstallPanel({ cacheReady }: { cacheReady: boolean }) {
  const { event, installed } = useInstall(),
    [guide, setGuide] = useState(false),
    [error, setError] = useState("");
  const ua = navigator.userAgent,
    android = /Android/i.test(ua),
    ios =
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    embedded = /MicroMessenger|QQ\/|Weibo/i.test(ua);
  return (
    <section className="panel">
      <h2>安装与下载</h2>
      <p className="hint" aria-label="离线缓存状态">
        {cacheReady
          ? "离线缓存已就绪，可在断网后打开使用。"
          : "首次联网打开后，请等待离线缓存完成。"}
      </p>
      <button
        className="primary"
        disabled={installed}
        onClick={async () => {
          setError("");
          if (event) {
            try {
              await promptInstall();
            } catch {
              setError("安装未完成，请按浏览器指引重试");
              setGuide(true);
            }
          } else setGuide(true);
        }}
      >
        {installed
          ? "已安装"
          : ios
            ? "添加到主屏幕"
            : android
              ? "安装到手机"
              : "安装到电脑"}
      </button>
      {(guide || ios || embedded) && (
        <div className="install-guide">
          <h3>安装指引</h3>
          <p>
            {embedded
              ? "请使用右上角菜单，在系统浏览器中打开本站。"
              : ios
                ? "在 Safari 分享菜单选择「添加到主屏幕」。"
                : android
                  ? "在 Chrome、Edge 或支持安装的浏览器菜单中选择「安装应用」或「添加到主屏幕」。"
                  : "在 Chrome / Edge 地址栏的安装图标或浏览器菜单中选择「安装此网站为应用」。Mac Safari 可使用「添加到程序坞」。"}
          </p>
          <p className="hint">
            如果菜单未出现，请确认不是无痕模式，等待页面加载完成后重试。已有数据时请先备份，并继续使用原浏览器入口。
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <Disclosure>
        <summary>离线与数据迁移</summary>
        <p className="hint">
          安装后先联网完成缓存。更换浏览器、访问地址或安装方式前导出完整备份，再从新入口导入；请勿先清除原数据。
        </p>
      </Disclosure>
    </section>
  );
}
