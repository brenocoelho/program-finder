import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    // The dev server's HMR client can reload the page mid-test in CI (slower, cold start),
    // dropping whatever the test just typed. CI runs the already-built app instead (see
    // ci.yml's "npm run build" step before this); locally the dev server is used as before.
    command: process.env.CI ? "PORT=5173 npm start" : "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
