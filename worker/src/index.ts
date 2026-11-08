/**
 * SKDL Bot — Cloudflare Worker entry point.
 * Telegram webhooks (POST /webhook), health check (GET / and /health),
 * short video link redirects (GET /:id and GET /v/:id),
 * and a cron trigger that replaces the Python heartbeat loop.
 */

import type { Update, UserFromGetMe } from "grammy/types";

import { createBot } from "./bot";
import { initSettings, type Env } from "./config";
import { getDownloadableFiles, resolveMediaFileToBeDownloaded } from "./moviebox/api";
import { Session } from "./moviebox/session";
import { getMedia, getRedis, updateBotHeartbeat } from "./services/supabase";
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

function extractLinkId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 1) {
    const id = parts[0];
    if (id !== "health" && id !== "webhook" && id !== "favicon.ico" && id !== "robots.txt") {
      return id;
    }
  }
  if (parts.length === 2 && parts[0] === "v") {
    return parts[1];
  }
  return null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderExpiredPage(
  title: string,
  type?: string | null,
  season?: number | null,
  episode?: number | null
): Response {
  const isSeries = type === "series";
  const displayTitle = isSeries && season && episode
    ? `${title} S${season.toString().padStart(2, "0")}E${episode.toString().padStart(2, "0")}`
    : title;

  const telegramMsg = isSeries && season && episode
    ? `hey, can I get ${title} Season ${season} Episode ${episode}`
    : `hey, can I get ${title}`;

  const tgUrl = `https://t.me/SK_DLBOT?text=${encodeURIComponent(telegramMsg)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Link Expired — SKDL</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #050505;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: #080808;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.25rem;
      padding: 2.25rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
    }
    .icon {
      width: 4rem;
      height: 4rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .icon svg { width: 2rem; height: 2rem; color: #71717a; }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
    }
    .code {
      font-family: monospace;
      color: #71717a;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.35em;
      font-weight: 900;
      margin-bottom: 1.25rem;
    }
    .title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #e4e4e7;
      margin-bottom: 0.5rem;
    }
    .desc {
      font-size: 0.75rem;
      color: #71717a;
      font-family: monospace;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .btn {
      display: block;
      width: 100%;
      background: #ffffff;
      color: #000000;
      font-size: 11px;
      font-weight: 900;
      padding: 1.1rem;
      border-radius: 0.75rem;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
      transition: background 0.2s, transform 0.1s;
    }
    .btn:hover { background: #e4e4e7; }
    .btn:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    </div>
    <h1>Link Expired</h1>
    <div class="code">Error 410 // Transmission_Expired</div>
    <div class="title">${escapeHtml(displayTitle)}</div>
    <div class="desc">This transmission ID has expired. Tap below to request fresh streaming and download links from the bot.</div>
    <a href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener noreferrer" class="btn">Request Again on Telegram</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
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

    // Short-link video redirect flow (GET /:id or GET /v/:id)
    if (request.method === "GET") {
      const linkId = extractLinkId(url.pathname);
      if (linkId) {
        initSettings(env);
        const row = await getMedia(linkId);

        if (!row) {
          // Check long-lived metadata record for expired link UI
          try {
            const r = getRedis();
            const metaRaw = await r.get<string>(`media:meta:${linkId}`);
            let meta: any = null;
            if (metaRaw) {
              meta = typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw;
            }
            if (meta?.title) {
              return renderExpiredPage(meta.title, meta.type, meta.season, meta.episode);
            }
          } catch (e) {
            console.error("Worker fallback meta lookup failed:", errMsg(e));
          }
          return new Response("Media not found", { status: 404 });
        }

        const expiresAt = new Date(row.expires_at);
        if (expiresAt < new Date()) {
          return renderExpiredPage(row.title, row.type, row.season, row.episode);
        }

        let targetUrl = row.cdn_url;

        // Fallback refresh only if stored CDN URL is absent
        if (!targetUrl && row.subject_id) {
          try {
            const session = new Session();
            const dummy = { subjectId: row.subject_id, detailPath: "" };
            const isSeries = row.type === "series";
            const downloadable = await getDownloadableFiles(
              session,
              dummy,
              isSeries ? (row.season ?? 0) : 0,
              isSeries ? (row.episode ?? 0) : 0
            );
            const file = resolveMediaFileToBeDownloaded(row.quality || "1080p", downloadable);
            if (file?.url) targetUrl = file.url;
          } catch (e) {
            console.error("Worker fallback resolve failed:", errMsg(e));
          }
        }

        if (!targetUrl) {
          return new Response("Video URL unavailable", { status: 404 });
        }

        /**
         * DIRECT CDN DELIVERY:
         * Issue a 302 redirect directly to the raw CDN URL resolved by the bot.
         * Video bytes stream directly from the CDN to the browser, bypassing Cloudflare entirely.
         */
        return Response.redirect(targetUrl, 302);
      }
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
