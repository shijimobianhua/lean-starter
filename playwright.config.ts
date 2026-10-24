import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  use: {
    ...(process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
    headless: true,
    baseURL: "http://127.0.0.1:4165",
    viewport: { width: 320, height: 740 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    colorScheme: "dark",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4165 --strictPort",
    url: "http://127.0.0.1:4165",
    reuseExistingServer: false,
    timeout: 30000,
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "artifacts/v166-browser-report",
        open: "never",
      },
    ],
  ],
  outputDir: "artifacts/v166-browser-results",
});
