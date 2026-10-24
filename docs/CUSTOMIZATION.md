# 改名称、图标、配色和界面

先理解个人非商业授权与来源声明。可以设计自己的个人版本，但保留 LICENSE、NOTICE 和可访问的来源入口，标注非官方身份与自己修改的内容。

## 配置

复制 .env.example 为自己本地的 .env.local（它已被Git忽略）：

- VITE_APP_NAME：浏览器标题及PWA安装名称，默认“薄肌 LEAN · 个人版”。
- VITE_PUBLIC_APP_URL：自己的固定正式HTTPS根地址；留空则分享指向当前站点。

这些变量都是公开值，不要放任何密钥。配置变更后重建。

## 代码位置

- 页面文案与导航：src/App.tsx；开场：src/Onboarding.tsx。
- 薄肌首页和页头：src/LeanHome.tsx；矢量线稿：src/LeanArt.tsx。
- 当前风格变量与布局：src/v166.css。修改前检查旧CSS的级联，不删掉历史键盘/弹窗修复。
- 分享模板：src/share-model.ts、share-layout.ts、share-renderer.ts，仍需保证真实1080×1440预览与下载一致。
- 图标：public/lean-icon-180.png、192.png、512.png和lean-favicon.svg；design/lean-icon-master.png为已有源图。
- PWA配置：vite.config.ts；iPhone图标与引导壳：index.html。
- 句库：src/builtin-quotes.ts。保留稳定索引；自己的内容需有使用权，英文仍需翻译。句库也可通过应用管理入口编辑导入，无需改代码。

## 不要把品牌变化当数据迁移

form-daily数据库名、FORM DAILY备份兼容标识和记录字段是历史兼容契约。改显示名称无需改这些键。换域名会产生新的浏览器存储空间，必须单独处理备份迁移。

改完至少运行 check、test、build及test:smoke，检查四种视觉组合和窄屏。重新绘制的资产注明自己的贡献，第三方字体或图标按其原许可使用。
