"""
SKDL Bot — main entry point.
Initializes the bot, registers routers, starts polling.
"""

import asyncio
import logging
import os
import sys

from aiohttp import web
from aiogram import Bot, Dispatcher

from config import settings
from handlers import start, movie, series, message, subtitle
from services.supabase import update_bot_heartbeat

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


async def heartbeat_loop() -> None:
    """Periodic task to update heartbeat in DB."""
    while True:
        try:
            await update_bot_heartbeat()
        except Exception:
            pass
        await asyncio.sleep(60)


async def health_check(_request: web.Request) -> web.Response:
    return web.Response(text="SKDL Bot is running", status=200)


async def start_health_server() -> web.AppRunner:
    """Lightweight HTTP server to satisfy Render/cloud port binding."""
    app = web.Application()
    app.router.add_get("/", health_check)
    app.router.add_get("/health", health_check)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.getenv("PORT", "8080"))
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logger.info("Health server listening on port %d", port)
    return runner


async def main() -> None:
    """Initialize bot and start polling."""
    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    dp = Dispatcher()

    # Register routers — message.router MUST be last (catch-all)
    dp.include_router(start.router)
    dp.include_router(movie.router)
    dp.include_router(series.router)
    dp.include_router(subtitle.router)
    dp.include_router(message.router)

    logger.info("SKDL Bot starting...")

    # Start health server for cloud platforms (Render, Railway, etc.)
    runner = await start_health_server()

    # Start heartbeat in background
    asyncio.create_task(heartbeat_loop())

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await runner.cleanup()
        await bot.session.close()
        logger.info("SKDL Bot stopped.")


if __name__ == "__main__":
    asyncio.run(main())

