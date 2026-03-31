"""
Message handler — catches all non-command text.
Routes through Groq AI for intent parsing, then dispatches accordingly.
This router MUST be registered last in main.py.
"""

from __future__ import annotations

import logging

from aiogram import Router
from aiogram.types import Message

from services.groq_service import parse_intent
from services.session import add_message, get_history, clear_session
from services.moviebox import get_movie, get_episode
from services.link import generate_id, build_url
from services.supabase import save_media

logger = logging.getLogger(__name__)
router = Router()

HELP_TEXT = """🎬 **How to use SKDL Bot:**

Just tell me what you want to watch in plain English!

**Examples:**
• "I want to watch The Dark Knight"
• "Download Stranger Things season 1 episode 3"
• "Get me Oppenheimer"

**Commands:**
/movie `<title>` — Direct movie download
/series `<title>` `<season>` `<episode>` — Direct episode download
/status — Check if bot is alive

I'll find it, generate a download link, and send it to you! 🍿"""


async def _handle_download_movie(message: Message, intent: dict) -> None:
    """Process a download_movie intent."""
    title = intent.get("title")
    if not title:
        await message.answer("🤔 I couldn't figure out the movie title. Could you be more specific?")
        return

    quality = intent.get("quality") or "1080p"
    status_msg = await message.answer(f"🔍 Searching for **{title}**...", parse_mode="Markdown")

    try:
        result = await get_movie(title, quality)

        link_id = generate_id()
        link_url = build_url(link_id)

        await save_media(
            link_id=link_id,
            title=result["title"],
            cdn_url=result["cdn_url"],
            media_type="movie",
            quality=result["quality"],
            requested_by=message.from_user.id,
        )

        reply = (
            f"🎬 **{result['title']} ({result['year']})**\n"
            f"Quality: {result['quality']}\n\n"
            f"📥 {link_url}\n"
            f"⏳ Link expires in 6 hours"
        )

        await status_msg.edit_text(reply, parse_mode="Markdown")

        # Attempt direct file delivery
        try:
            from aiogram.types import URLInputFile
            file_name = f"{result['title']} ({result['year']}) {result['quality']}.mp4"
            await message.answer_document(
                URLInputFile(result["cdn_url"], filename=file_name),
                caption=f"🎬 {result['title']}"
            )
        except Exception as e:
            logger.warning("Direct file delivery failed for '%s': %s", result['title'], e)
            # We don't notify the user because the link is the primary delivery method

        clear_session(message.from_user.id)

    except Exception as exc:
        logger.error("Movie download failed: %s", exc)
        await status_msg.edit_text(
            f"❌ Couldn't find or process **{title}**. Try a different title or check the spelling.",
            parse_mode="Markdown",
        )


async def _handle_download_series(message: Message, intent: dict) -> None:
    """Process a download_series intent."""
    title = intent.get("title")
    season = intent.get("season")
    episode = intent.get("episode")

    if not title:
        await message.answer("🤔 I couldn't figure out the series title. Could you be more specific?")
        return

    if season is None or episode is None:
        await message.answer(
            f"📺 I found **{title}**, but I need the season and episode number.\n"
            f"Example: \"{title} season 2 episode 5\"",
            parse_mode="Markdown",
        )
        return

    quality = intent.get("quality") or "1080p"
    status_msg = await message.answer(
        f"🔍 Searching for **{title}** S{season}E{episode}...", parse_mode="Markdown"
    )

    try:
        result = await get_episode(title, int(season), int(episode), quality)

        link_id = generate_id()
        link_url = build_url(link_id)

        await save_media(
            link_id=link_id,
            title=result["title"],
            cdn_url=result["cdn_url"],
            media_type="series",
            quality=result["quality"],
            season=result["season"],
            episode=result["episode"],
            requested_by=message.from_user.id,
        )

        reply = (
            f"📺 **{result['title']} S{result['season']}E{result['episode']}**\n"
            f"Quality: {result['quality']}\n\n"
            f"📥 {link_url}\n"
            f"⏳ Link expires in 6 hours"
        )

        await status_msg.edit_text(reply, parse_mode="Markdown")

        # Attempt direct file delivery
        try:
            from aiogram.types import URLInputFile
            file_name = f"{result['title']} S{result['season']}E{result['episode']} {result['quality']}.mp4"
            await message.answer_document(
                URLInputFile(result["cdn_url"], filename=file_name),
                caption=f"📺 {result['title']} S{result['season']}E{result['episode']}"
            )
        except Exception as e:
            logger.warning("Direct file delivery failed for series '%s': %s", result['title'], e)

        clear_session(message.from_user.id)

    except Exception as exc:
        logger.error("Series download failed: %s", exc)
        await status_msg.edit_text(
            f"❌ Couldn't find **{title}** S{season}E{episode}. Check the title and episode number.",
            parse_mode="Markdown",
        )


@router.message()
async def handle_message(message: Message) -> None:
    """Catch-all message handler — routes through Groq AI."""
    if not message.text:
        return

    user_id = message.from_user.id
    user_text = message.text.strip()

    # Store user message in session
    add_message(user_id, "user", user_text)

    # Get intent from Groq
    history = get_history(user_id)
    intent = await parse_intent(history, user_text)

    match intent["intent"]:
        case "download_movie":
            await _handle_download_movie(message, intent)

        case "download_series":
            await _handle_download_series(message, intent)

        case "clarify":
            clarify_msg = intent.get("clarify_message") or "Could you give me more details?"
            add_message(user_id, "assistant", clarify_msg)
            await message.answer(f"🤔 {clarify_msg}")

        case "help":
            await message.answer(HELP_TEXT, parse_mode="Markdown")

        case "chat" | _:
            chat_response = intent.get("chat_response") or "I'm here to help you download movies and series! Just tell me what you want to watch."
            add_message(user_id, "assistant", chat_response)
            await message.answer(chat_response)
