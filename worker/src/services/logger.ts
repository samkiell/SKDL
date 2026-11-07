/**
 * logger.ts — Async logging service for bot events.
 * Writes to Redis `bot_logs` list and updates analytics counters.
 */

import { getRedis } from "./supabase";
import { errMsg, pyIsoNow, trackBackground } from "../util";

export interface LogEventArgs {
  user_id: number;
  username: string | null | undefined;
  display_name: string | null | undefined;
  action: string;
  query?: string | null;
  result_title?: string | null;
  result_found?: boolean;
  error_message?: string | null;
  duration_ms?: number | null;
}

async function doLogEvent(args: LogEventArgs): Promise<void> {
  const row = {
    user_id: args.user_id,
    username: args.username ?? null,
    display_name: args.display_name ?? null,
    action: args.action,
    query: args.query ?? null,
    result_title: args.result_title ?? null,
    result_found: args.result_found ?? false,
    error_message: args.error_message ?? null,
    duration_ms: args.duration_ms ?? null,
    created_at: pyIsoNow(),
  };

  try {
    const r = getRedis();
    const today = new Date().toISOString().slice(0, 10);
    const p = r.pipeline();
    // Keep recent 1000 logs in a capped list
    p.lpush("bot_logs", JSON.stringify(row));
    p.ltrim("bot_logs", 0, 999);
    // Atomic analytics counters
    p.incr("stats:total_requests");
    p.incr(`stats:requests:${today}`);
    p.pfadd("stats:unique_users", String(args.user_id));
    p.pfadd(`stats:unique_users:${today}`, String(args.user_id));
    if (args.result_found) p.incr("stats:found_requests");
    await p.exec();
  } catch (exc) {
    // Never raise or block the bot — just log to console
    console.error(`Failed to write to bot_logs in Redis: ${errMsg(exc)}`);
  }
}

/** Fire-and-forget logging of a bot event. */
export function logEvent(args: LogEventArgs): void {
  trackBackground(doLogEvent(args));
}
