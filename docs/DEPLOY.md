# 独立部署教程

本仓库是静态 React/Vite PWA。没有必须连接的原站API、云数据库、官方账号或AI密钥。每个人的记录保存在其访问站点的浏览器中。

## Cloudflare Pages：GitHub连接方式

1. 先把源码复制到你自己的 GitHub 仓库。
2. 登录你自己的 Cloudflare，在 Workers & Pages 中创建 Pages 项目，连接自己的 GitHub 仓库。授权范围只选需要的个人仓库。
3. 根目录使用仓库根，构建命令 npm run build，输出目录 dist。使用 Node24；仓库有 .nvmrc 和 .node-version，也可设置环境变量 NODE_VERSION=24。
4. 不配置任何原作者凭据。部署成功后，打开平台返回给你的地址。
5. 测试引导、四种风格组合、记录保存、刷新、分享二维码、下载、离线和手机安装。
6. 后续更新由你自己的分支及Pages项目决定，不会更新原站。

官方参考：
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/build-image/

## 正式网址和分享回流

默认 VITE_PUBLIC_APP_URL 为空。构建后的二维码、复制链接和分享回流地址使用当前打开的 origin，因此别人的卡片会指向别人的网站。

若需要预览站的卡片也指向自己的正式网址，在自己的托管环境配置 VITE_PUBLIC_APP_URL=https://your-personal-domain.example/ 并重新构建。只填你控制的长期HTTPS根地址，不附加查询、片段或子路径。不要填写上游正式站。

改自己的域名时先保护用户备份；不同域名的本机数据不会自动迁移。测试站和正式站也不是同一份浏览器数据。固定二维码网址不能替代数据迁移。

## 其他静态托管

通常先 npm ci、npm run build，再把完整 dist 目录部署到自己的 HTTPS 站点根路径。不要把源码目录当构建目录，不要遗漏 sw.js、workbox脚本、manifest和图标，不要用 file:// 测试。

子路径（例如 /repo/）需要同步适配 Vite base、所有绝对资源路径、PWA scope/start_url/id、navigateFallback和分享网址，不在首版默认支持范围内。

若使用 Sites 类 AI 托管：在你自己的账号创建新Site，再使用它返回的配置与发布权限。本仓库不含 .openai/hosting.json；不能从官方站复制。npm run audit:public 是准备公开通用模板的检查，会拒绝活动托管身份文件，个人Sites目录含自有配置时可运行正常 npm run check/build，不把自己的发布身份再分发成通用模板。

## 安装和离线

iPhone使用Safari添加到主屏幕；安卓使用支持PWA的浏览器菜单安装。先联网完成缓存后再测试断网。手机可能没有与桌面相同的文件夹备份或系统文件分享能力，要保留下载备份的降级路径。

保留PWA稳定域名和身份。更新前保存正在编辑的内容，按应用提示更新；不要通过卸载或清网站数据解决普通更新问题。

## 部署故障

- 构建失败：检查Node24、npm ci和实际日志，先在本地重现。
- HTML出现但资源404：检查根路径与dist内容，不要只上传index.html。
- 能打开但不能安装：检查HTTPS、manifest、图标、浏览器支持和缓存状态。
- 分享跳错网站：检查VITE_PUBLIC_APP_URL，修改后需要重建；未配置时默认当前站点。
- 数据看起来为空：确认访问的域名、浏览器、设备及隐私模式是否变化。先保留原环境，不能清库尝试。

构建后的 dist/licenses/ 中包含项目和第三方许可副本，部署时请连同全部产物一起保留。
