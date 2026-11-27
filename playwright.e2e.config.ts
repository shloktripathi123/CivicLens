import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:41942",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node --import tsx tests/e2e/server.ts",
      url: "http://127.0.0.1:41941/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm run dev -w @civic/web -- --hostname 127.0.0.1 --port 41942",
      url: "http://127.0.0.1:41942",
      reuseExistingServer: false,
      timeout: 120000,
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:41941" },
    },
  ],
});
