// src/lib/logger.ts
type Lvl = "debug" | "info" | "warn" | "error";
const order: Record<Lvl, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const lvl = (process.env.LOG_LEVEL as Lvl) || "info";

export function log(level: Lvl, msg: string, extra: Record<string, unknown> = {}) {
  if (order[level] < order[lvl]) return;
  console.log(JSON.stringify({ t: Date.now(), level, msg, ...extra }));
}

export type LogMeta = Record<string, unknown> | undefined;

export const logger = {
  info(message: string, meta?: LogMeta) {
    log('info', message, meta || {});
  },
  warn(message: string, meta?: LogMeta) {
    log('warn', message, meta || {});
  },
  error(message: string, err?: unknown, meta?: LogMeta) {
    const e = err as { message?: string; stack?: string } | undefined;
    log('error', message, { error: e?.message, stack: e?.stack, ...(meta || {}) });
  },
};
