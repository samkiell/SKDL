/**
 * SKDL Cloudflare Worker — Zero-Proxy Short Link Redirect Service.
 *
 * Responsibilities:
 *  - Short video link redirects (GET /:id and GET /v/:id) -> 302 directly to raw CDN URL
 *  - Legacy proxy redirect (GET /api/proxy?url=...) -> 302 directly to URL (or 410 if missing)
 *  - Styled expired page (410) when links exceed TTL
 *  - Health check (GET / and /health)
 *
 * All bot, search, and MovieBox resolution logic runs exclusively on Render.
 * Cloudflare NEVER fetches, streams, or proxies video bytes.
 */

import { initSettings, type Env } from "./config";
import { getMedia, getRedis } from "./services/supabase";
import { errMsg } from "./util";

function extractLinkId(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 1) {
    const id = parts[0];
    if (id !== "health" && id !== "webhook" && id !== "favicon.ico" && id !== "robots.txt" && id !== "api") {
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
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #ef4444;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.5rem;
    }
    .title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 1rem;
      word-break: break-word;
    }
    .desc {
      font-size: 0.875rem;
      color: #a1a1aa;
      line-height: 1.5;
      margin-bottom: 2rem;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0.875rem 1.25rem;
      border-radius: 0.75rem;
      background: #ffffff;
      color: #000000;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background: #e4e4e7;
    }
    .footer {
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span>●</span> Link Expired
    </div>
    <h1>Stream Session Expired</h1>
    <div class="title">${escapeHtml(displayTitle)}</div>
    <p class="desc">
      To protect bandwidth and keep links fresh, stream sessions expire after 6 hours.
      Request this title again in Telegram to instantly generate a fresh streaming link.
    </p>
    <a href="${tgUrl}" class="btn">
      Request Fresh Link on Telegram
    </a>
    <div class="footer">
      Powered by SKDL • Direct CDN Delivery
    </div>
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response("SKDL Redirect Service is running", { status: 200 });
    }

    // Legacy /api/proxy route -> immediate 302 redirect directly to URL
    if (request.method === "GET" && url.pathname === "/api/proxy") {
      const target = url.searchParams.get("url");
      if (!target || target === "undefined" || target === "null") {
        return new Response("Gone or Missing URL", { status: 410 });
      }
      return Response.redirect(target, 302);
    }

    // Short-link video redirect flow (GET /:id or GET /v/:id)
    if (request.method === "GET") {
      const linkId = extractLinkId(url.pathname);
      if (linkId) {
        initSettings(env);
        const row = await getMedia(linkId);

        if (!row) {
          // Check long-lived metadata record for styled expired link UI
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

        const targetUrl = row.cdn_url;
        if (!targetUrl) {
          return new Response("Video URL unavailable", { status: 404 });
        }

        /**
         * DIRECT CDN DELIVERY:
         * Issue a 302 redirect directly to the raw CDN URL resolved by the bot.
         * Video bytes stream directly from the CDN to the client, bypassing Cloudflare entirely.
         */
        return Response.redirect(targetUrl, 302);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
