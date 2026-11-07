/**
 * SKDL Bot — Cloudflare Worker entry point.
 * Telegram webhooks (POST /webhook), health check (GET / and /health),
 * and a cron trigger that replaces the Python heartbeat loop.
 */

import type { Update, UserFromGetMe } from "grammy/types";

import { createBot } from "./bot";
import { initSettings, type Env } from "./config";
import { updateBotHeartbeat } from "./services/supabase";
import { errMsg, flushBackground } from "./util";

// Reused across requests within an isolate to avoid a getMe call per update.
let cachedBotInfo: UserFromGetMe | undefined;

async function processUpdate(env: Env, update: Update): Promise<void> {
  try {
    const settings = initSettings(env);
    const bot = createBot(settings.TELEGRAM_BOT_TOKEN, cachedBotInfo);
    if (!cachedBotInfo) {
      await bot.init();
      cachedBotInfo = bot.botInfo;
    }
    await bot.handleUpdate(update);
  } catch (exc) {
    console.error(`Update ${update.update_id} failed: ${errMsg(exc)}`);
  } finally {
    // Wait for fire-and-forget work (e.g. log_event) before the Worker is torn down.
    await flushBackground();
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response("SKDL Bot is running", { status: 200 });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      let update: Update;
      try {
        update = (await request.json()) as Update;
      } catch {
        return new Response("Bad Request", { status: 400 });
      }
      // Acknowledge immediately so Telegram never retries slow (download/search) updates.
      ctx.waitUntil(processUpdate(env, update));
      return new Response("ok", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          initSettings(env);
          await updateBotHeartbeat();
        } catch {
          // same as the Python heartbeat loop: never raise
        }
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
