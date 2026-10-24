import fs from "node:fs";
import { version } from "./package.json";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const appName = env.VITE_APP_NAME?.trim() || "薄肌 LEAN · 个人版";
  const escapedName = appName
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return {
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      {
        name: "starter-license-assets",
        generateBundle() {
          for (const [fileName, sourcePath] of [
            ["PROJECT-LICENSE.txt", "LICENSE"],
            ["NOTICE.txt", "NOTICE"],
            ["THIRD-PARTY-NOTICES.txt", "THIRD_PARTY_NOTICES.md"],
            ["THIRD-PARTY-LICENSES.txt", "docs/THIRD_PARTY_LICENSES.txt"],
          ])
            this.emitFile({
              type: "asset",
              fileName: "licenses/" + fileName,
              source: fs.readFileSync(sourcePath, "utf8"),
            });
        },
      },
      {
        name: "starter-title",
        transformIndexHtml(html: string) {
          return html
            .replace(/<title>[^<]*<\/title>/, `<title>${escapedName}</title>`)
            .replace(
              /name="apple-mobile-web-app-title" content="[^"]*"/,
              `name="apple-mobile-web-app-title" content="${escapedName}"`,
            );
        },
      },
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "icon.svg",
          "lean-favicon.svg",
          "lean-icon-180.png",
          "lean-icon-192.png",
          "lean-icon-512.png",
          "icon-192.png",
          "icon-512.png",
          "apple-touch-icon.png",
          "icon-maskable.png",
          "icons/*.png",
        ],
        manifest: {
          name: appName,
          short_name: appName,
          id: "/",
          lang: "zh-CN",
          start_url: "/",
          display: "standalone",
          background_color: "#f1f2f4",
          theme_color: "#141312",
          icons: [
            {
              src: "/lean-icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/lean-icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,txt}"],
          navigateFallback: "/index.html",
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      maxWorkers: 2,
      testTimeout: 15000,
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test-setup.ts"],
      css: false,
    },
  };
});
