"""
/start and /status command handlers.
"""

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from services.session import clear_session

router = Router()

WELCOME_MESSAGE = """🤖 **AI-POWERED CINEMATIC DISCOVERY // SKDL** 🍿

I'm your assistant for high-speed movie and series downloads. Just tell me what you want in plain English, or **drop an image** (screenshot/poster) and I'll find it for you!

**Direct Examples:**
• "I want to watch Avatar"
• "Download season 1 of Stranger Things"
• "Get me Inception in 1080p"

**Shortcuts:**
🎬 `/movie [title]` — Direct movie fetch
📺 `/series [title] [season] [episode]` — Direct episode fetch
📊 `/status` — Check bot health

Or just send me a message — I'm built by **SAMKIEL** and I'm ready to find your next watch! 🎬"""

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
