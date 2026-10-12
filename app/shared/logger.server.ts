import pino from "pino";
import { env } from "~/shared/env.server";

// Plain JSON to stdout in every environment. No transport: pino runs a
// transport in a worker thread, which cannot resolve its target under the
// Vite dev server. To read the lines in a terminal: `npm run dev | npx pino-pretty`.
export const logger = pino({ level: env.LOG_LEVEL });
