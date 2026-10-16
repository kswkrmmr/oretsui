import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // 散歩アプリなのでスマホ（iPhone / Android）で検証する
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // E2E では本物の Google Maps を読み込まない（通信はテスト側で遮断する）。
    // 地図コンテナを描画させるためにダミーのキーを渡す（#4 で許可）
    env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "e2e-dummy-key" },
  },
});
