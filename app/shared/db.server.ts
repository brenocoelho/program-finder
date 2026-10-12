import postgres from "postgres";
import { env } from "~/shared/env.server";

function createSql() {
  return postgres(env.DATABASE_URL, {
    max: 10,
    connect_timeout: 5,
    types: {
      // Money is stored as bigint cents. Safe as a number up to 2^53.
      bigint: {
        to: 20,
        from: [20],
        serialize: (value: number) => value.toString(),
        parse: (value: string) => {
          const n = Number(value);
          if (!Number.isSafeInteger(n)) throw new Error("bigint out of range");
          return n;
        },
      },
    },
  });
}

// One pool for the process: survives Vite HMR reloads of this module.
const globalForDb = globalThis as typeof globalThis & {
  __finderSql?: ReturnType<typeof createSql>;
};

export const sql = (globalForDb.__finderSql ??= createSql());
