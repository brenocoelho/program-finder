import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@localhost:5433/finder"),
  // Used by integration tests only. Must never point at the dev database.
  TEST_DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@localhost:5433/finder_test"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Field names only: a bad *_DATABASE_URL may hold a password.
  const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
  throw new Error(`Invalid environment variables: ${fields.join(", ")}`);
}

export const env: Env = parsed.data;
