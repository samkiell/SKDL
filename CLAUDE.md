# CLAUDE.md — Instructions for Claude Code

This file is the source of truth for all development decisions on this project.
Read this fully before writing any code. Do not deviate from these instructions.

---

## What This Project Is

A two-service monorepo:
1. `bot/` — Python Telegram bot (`@SK_DLBOT`) using aiogram 3.x and Groq AI
2. `web/` — Next.js 14 link redirect server deployed at `movies.samkiel.dev`

Full spec is in `PRD.md`. Read it.

---

## Absolute Rules

- **Never use Flask or FastAPI** in the bot service. The bot is aiogram only.
- **Never use `python-telegram-bot` library.** Use `aiogram` 3.x only.
- **Never use Pages Router in Next.js.** App Router only.
- **Never use `any` type in TypeScript** unless absolutely unavoidable.
- **Never create files outside the defined folder structure** without a clear reason.
- **Never hardcode secrets.** All secrets come from environment variables via `config.py` (bot) or `.env.local` (web).
- **Never add dependencies not in this list** without asking first.
- **Always handle errors.** Every async call must have try/except (Python) or try/catch (TS).
- **Keep changes scoped.** If asked to fix one thing, fix only that thing.

---

## Data Sources

- **moviebox-api**: Primary source for video URLs, posters, and subtitles.
- **TMDB**: Fallback source for posters only (requires `TMDB_API_KEY`).
- **OpenSubtitles**: Fallback source for subtitles only.

Fallback chains must be explicit and ordered:
- **Posters**: Database -> MovieBox -> TMDB -> Dark Placeholder.
- **Subtitles**: MovieBox -> OpenSubtitles -> null.

---

## Bot — Python Conventions

### Approved dependencies only:
```
aiogram==3.x
groq
supabase
python-dotenv
nanoid
moviebox-api
httpx
```

### Config pattern:
All env vars loaded in `config.py` using `python-dotenv`. Imported everywhere as:
```python
from config import settings
```

`config.py` must use a `Settings` dataclass or simple namespace — not scattered `os.getenv()` calls throughout the codebase.

### File structure — do not change this:
```
bot/
  main.py              # bot init, register routers, start polling
  config.py            # all env vars in one place
  requirements.txt
  .env.example
  handlers/
    start.py           # /start and /status commands
    movie.py           # /movie <title> command
    series.py          # /series <title> <season> <episode> command
    message.py         # catches all non-command text → routes through Groq
  services/
    moviebox.py        # interfaces with moviebox-api, returns subject_id + metadata
    supabase.py        # all DB reads and writes (id, subject_id, etc.)
    link.py            # nanoid generation (lowercase alphabet), link building
    groq_service.py    # Groq API call, returns parsed intent dict
    session.py         # in-memory dict keyed by telegram user_id
```

### aiogram patterns to follow:
```python
# Router pattern — each handler file creates its own router
from aiogram import Router
router = Router()

# Register in main.py
from handlers import start, movie, series, message
dp.include_router(start.router)
dp.include_router(movie.router)
dp.include_router(series.router)
dp.include_router(message.router)  # message.router must be LAST
```

### Groq intent schema — always return this shape:
```python
{
  "intent": "download_movie" | "download_series" | "clarify" | "chat" | "help",
  "title": str | None,
  "year": int | None,
  "season": int | None,
  "episode": int | None,
  "quality": "best" | "1080p" | "720p" | "480p" | None,
  "clarify_message": str | None,
  "chat_response": str | None
}
```

If Groq returns malformed JSON, catch the error and reply with a fallback message. Never crash.

### Session management:
```python
# session.py — in-memory only for MVP
sessions: dict[int, list] = {}
MAX_HISTORY = 10
```
Clear session after successful download or on `/start`.

### Delivery logic (CRITICAL):
CDN URLs are IP-locked. Telegram's servers are often blocked.
1. **The Web Redirect**: `app/[id]/page.tsx` MUST fetch a fresh CDN URL using the stored `subject_id` for every unique visitor.
2. **The Proxy**: All video URLs MUST be served through `/api/proxy?url=...` with spoofed `Referer` (`https://fmoviesunblocked.net/`) and `Origin`.
3. **The Bot Delivery**: Bot now downloads the file to a local temp buffer/file using the stealth headers, then uploads it as a document to Telegram. This bypasses the CDN's block on Telegram's IP. Delete temp files immediately after.

---

## Web — Next.js Conventions

### Stack:
- Next.js 16 (React 19, Turbopack)
- Supabase JS client (`@supabase/supabase-js`)
- Tailwind CSS / shadcn/ui

### File structure — do not change this:
```
web/
  app/
    api/
      proxy/
        route.ts    # Stealth video proxy
    [id]/
      page.tsx      # dynamic refresh + redirect logic
    not-found.tsx   # 404 page
    layout.tsx      # root layout
    page.tsx        # root page (redirects to TG)
  lib/
    supabase.ts     # createClient() export
    moviebox.ts     # fresh CDN URL fetcher (server-side)
```

### Environment Variables:
```
SUPABASE_URL
SUPABASE_KEY
NEXT_PUBLIC_BOT_USERNAME
GROQ_API_KEY
OPENSUBTITLES_API_KEY
TMDB_API_KEY
NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_SRC
NEXT_PUBLIC_ADSTERRA_BANNER_TAG
NEXT_PUBLIC_ADS
LIGHTHOUSE_PIN
```

### The `/api/proxy` logic:
Must spoof these exact headers on every fetch to the CDN:
- `User-Agent`: Modern Chrome/Firefox
- `Referer`: `https://fmoviesunblocked.net/`
- `Origin`: `https://h5.aoneroom.com`
- `Accept-Encoding`: `identity`
- `Range`: `bytes=0-` (initial) or pass-through from request

### The `[id]` route – exact logic:
Must include `export const dynamic = 'force-dynamic'` to bypass stale 404 caching.
1. Get `id` from params.
2. Query Supabase `media` table for `subject_id`.
3. If valid, fetch **new** CDN URL using `lib/moviebox.ts`.
4. Redirect to `/api/proxy?url={encoded_new_url}`.

### Styling rules:
- Dark background (`#0f0f0f` or `bg-zinc-950`)
- White/gray text
- Minimal — expired page needs: title, message, one CTA button
- No animations, no heavy UI
- Mobile first

### Expired page copy:
```
Title of movie/series
"This download link has expired."
[Request again on Telegram] → https://t.me/SK_DLBOT
```

### 404 page copy:
```
"Link not found."
[Go to bot] → https://t.me/SK_DLBOT
```

### Root page (`app/page.tsx`):
Redirect immediately to `https://t.me/SK_DLBOT`

---

## Database

### Supabase table: `media`
```sql
create table media (
  id            text primary key,          -- lowercase nanoid (8 chars)
  title         text not null,
  cdn_url       text not null,             -- fallback / original URL
  type          text not null check (type in ('movie', 'series')),
  quality       text default '1080p',
  season        integer null,
  episode       integer null,
  requested_by  bigint null,
  requested_at  timestamptz default now(),
  expires_at    timestamptz not null,
  subject_id    text                       -- REQUIRED for IP-bound refresh
);
```

The table must already exist. Do not write migration files — the table is created manually in Supabase dashboard.

---

## What To Build First (Order)

Follow this order exactly:

1. `bot/config.py` — env var loading
2. `bot/services/session.py` — in-memory session store
3. `bot/services/groq_service.py` — Groq intent parsing
4. `bot/services/link.py` — nanoid + URL builder
5. `bot/services/supabase.py` — DB save and lookup
6. `bot/services/moviebox.py` — CDN URL extraction (investigate internals first)
7. `bot/handlers/start.py` — /start and /status
8. `bot/handlers/message.py` — main message router
9. `bot/handlers/movie.py` — /movie command
10. `bot/handlers/series.py` — /series command
11. `bot/main.py` — wire everything together
12. `bot/requirements.txt` and `bot/.env.example`
13. `web/lib/supabase.ts`
14. `web/app/[id]/page.tsx`
15. `web/app/not-found.tsx`
16. `web/app/page.tsx`
17. `web/app/layout.tsx`
18. `web/.env.example` and `web/package.json`

---

## Do Not

- Do not add Redis (not in MVP scope)
- Do not add rate limiting (not in MVP scope)
- Do not add subtitle language selection (default English always)
- Do not add subtitle language selection (default English always)
- Do not use webhooks for the bot (use polling for MVP)
- Do not use `next/image` for external images (not needed)
- Do not add a public REST API (future scope)
- Do not install packages outside the approved list without flagging it

---

## Lighthouse Admin
- Route is `/lighthouse`
- Auth is cookie-based, PIN from `LIGHTHOUSE_PIN` env var (8-hour session)
- Protected by middleware (`web/middleware.ts`)
- All Supabase queries for this page are server-side only via API routes

---

## When In Doubt

- Check `PRD.md` for feature scope
- Check this file for implementation decisions
- Ask before adding anything not specified here
