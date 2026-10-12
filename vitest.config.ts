import { defineConfig } from "vitest/config";
import { env } from "./app/shared/env.server.ts";

// Separate from vite.config.ts: that one loads the React Router plugin, which
// is not meant to run under Vitest.
// Two projects: `unit` (pure, no database) and `integration` (real Postgres,
// the finder_test database). `npm test` runs both.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          include: ["**/*.test.ts"],
          exclude: [
            "**/node_modules/**",
            "build/**",
            "e2e/**",
            "**/*.integration.test.ts",
          ],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "integration",
          include: ["**/*.integration.test.ts"],
          exclude: ["**/node_modules/**", "build/**", "e2e/**"],
          // The app's env module reads DATABASE_URL, so point it at the test database.
          env: { DATABASE_URL: env.TEST_DATABASE_URL },
          globalSetup: ["./vitest.integration-setup.ts"],
          // Test files share one database: run them one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
