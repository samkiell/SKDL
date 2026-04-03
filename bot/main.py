"""
SKDL Bot — main entry point.
Initializes the bot, registers routers, starts polling.
"""

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher

from config import settings
from handlers import start, movie, series, message

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


async def main() -> None:
    """Initialize bot and start polling."""
    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    dp = Dispatcher()

    # Register routers — message.router MUST be last (catch-all)
    dp.include_router(start.router)
    dp.include_router(movie.router)
    dp.include_router(series.router)
    dp.include_router(message.router)

    logger.info("SKDL Bot starting...")

    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()
        logger.info("SKDL Bot stopped.")


if __name__ == "__main__":
    asyncio.run(main())
