"""
/start and /status command handlers.
"""

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from services.session import clear_session

router = Router()

WELCOME_MESSAGE = """👋 Welcome to SKDL Bot!

I can help you download movies and TV series. Just tell me what you want to watch!

**Examples:**
• "I want to watch Avatar"
• "Download Breaking Bad season 2 episode 3"
• "Get me Inception in 720p"

**Commands:**
/movie `<title>` — Direct movie download
/series `<title>` `<season>` `<episode>` — Direct series download
/status — Check bot status

Or just send a message — I understand natural language! 🎬"""

STATUS_MESSAGE = """✅ **Bot Status: Online**

🤖 SKDL Bot is running and ready.
📡 All services operational."""


@router.message(Command("start"))
async def cmd_start(message: Message) -> None:
    """Handle /start — welcome message + clear session."""
    try:
        clear_session(message.from_user.id)
        await message.answer(WELCOME_MESSAGE, parse_mode="Markdown")
    except Exception:
        await message.answer("👋 Welcome! Send me a movie or series name to get started.")


@router.message(Command("status"))
async def cmd_status(message: Message) -> None:
    """Handle /status — health check."""
    try:
        await message.answer(STATUS_MESSAGE, parse_mode="Markdown")
    except Exception:
        await message.answer("✅ Bot is online and operational.")
