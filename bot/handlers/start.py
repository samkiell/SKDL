"""
/start, /status, /feedback, /privacy, and /terms command handlers.
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
💬 `/feedback` — Share your thoughts

**Legal:**
⚖️ `/privacy` — Privacy Policy
📜 `/terms` — Terms of Use

Built by **SAMKIEL**. Ready to find your next watch! 🎬"""

STATUS_MESSAGE = """✅ **Bot Status: Online**

🤖 SKDL Bot is running and ready.
📡 All services operational."""

FEEDBACK_MESSAGE = """💬 **WE VALUE YOUR INPUT**

Help us improve SKDL by sharing your thoughts, bug reports, or suggestions.

🔗 Submit feedback: https://skdlm.vercel.app/feedback

Your input directly shapes the future of this bot. Thanks for being part of the journey!"""

PRIVACY_MESSAGE = """⚖️ **PRIVACY POLICY**

Your privacy is important to us. Read our full policy here:
🔗 https://skdlm.vercel.app/privacy"""

TERMS_MESSAGE = """📜 **TERMS OF USE**

By using SKDL, you agree to our terms. Read them here:
🔗 https://skdlm.vercel.app/terms"""


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


@router.message(Command("feedback"))
async def cmd_feedback(message: Message) -> None:
    """Handle /feedback command."""
    try:
        await message.answer(FEEDBACK_MESSAGE, parse_mode="Markdown")
    except Exception:
        await message.answer("💬 Share your feedback: https://skdlm.vercel.app/feedback")


@router.message(Command("privacy"))
async def cmd_privacy(message: Message) -> None:
    """Handle /privacy command."""
    try:
        await message.answer(PRIVACY_MESSAGE, parse_mode="Markdown")
    except Exception:
        await message.answer("⚖️ Privacy Policy: https://skdlm.vercel.app/privacy")


@router.message(Command("terms"))
async def cmd_terms(message: Message) -> None:
    """Handle /terms command."""
    try:
        await message.answer(TERMS_MESSAGE, parse_mode="Markdown")
    except Exception:
        await message.answer("📜 Terms of Use: https://skdlm.vercel.app/terms")
