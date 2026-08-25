import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["BASE_URL"] || "http://127.0.0.1:5173";
const startLocal = !process.env["BASE_URL"];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  ...(startLocal
    ? {
        webServer: {
          command:
            "SUPABASE_URL=https://example.supabase.co SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_placeholder VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_placeholder bun run dev -- --host 127.0.0.1 --port 5173",
          url: "http://127.0.0.1:5173/auth",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
