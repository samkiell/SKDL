"""
Message handler — catches all non-command text.
Routes through Groq AI for intent parsing, then dispatches accordingly.
This router MUST be registered last in main.py.
"""

from __future__ import annotations

import logging

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder

from services.groq_service import parse_intent
from services.session import (
    add_message, get_history, clear_session,
    set_pending_request, get_pending_request, clear_pending_request
)
from services.moviebox import get_movie, get_episode, get_available_qualities
from services.link import generate_id, build_url
from services.supabase import save_media

logger = logging.getLogger(__name__)
router = Router()

HELP_TEXT = """🎬 **SKDL — Netflix and Chill with SKDL** 🍿

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


async def _present_quality_options(message: Message, intent: dict, user_id: int) -> bool:
    """Returns True if presented, False if skipped (no options/already chose)."""
    if intent.get("_quality_selected"):
        return False

    title = intent.get("title")
    is_series = intent.get("intent") == "download_series"
    season = intent.get("season")
    episode = intent.get("episode")

    status_msg = await message.answer(f"🔍 Locating **{title}**...", parse_mode="Markdown")

    data = await get_available_qualities(title, is_series, season, episode)
    qualities = data.get("qualities", [])

    if not qualities:
        await status_msg.delete()
        return False

    set_pending_request(user_id, intent)

    builder = InlineKeyboardBuilder()
    for q in qualities[:5]:
        mb_size = q['size'] // 1024 // 1024
        builder.button(text=f"🎬 {q['label']} ({mb_size}MB)", callback_data=f"q:{q['label']}")

    builder.adjust(1)
    await status_msg.edit_text(
        f"✅ Found **{data.get('title', title)}**.\nChoose your quality 👇",
        reply_markup=builder.as_markup(),
        parse_mode="Markdown"
    )
    return True


async def _handle_download_movie(message: Message, intent: dict, user_id: int) -> None:
    """Process a download_movie intent."""
    title = intent.get("title")
    if not title:
        await message.answer("🤔 I couldn't figure out the movie title. Could you be more specific?")
        return

    if await _present_quality_options(message, intent, user_id):
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
            requested_by=user_id,
            subject_id=result["subject_id"],
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

        clear_session(user_id)

    except Exception as exc:
        logger.error("Movie download failed: %s", exc)
        await status_msg.edit_text(
            f"❌ Couldn't find or process **{title}**. Try a different title or check the spelling.",
            parse_mode="Markdown",
        )


async def _handle_download_series(message: Message, intent: dict, user_id: int) -> None:
    """Process a download_series intent."""
    title = intent.get("title")
    season = intent.get("season")
    episode = intent.get("episode")

    if not title:
        await message.answer("🤔 I couldn't figure out the series title. Could you be more specific?")
        return

    if intent.get("bulk") and season is not None:
        await _handle_bulk_series(message, intent, user_id)
        return

    if season is None or episode is None:
        await message.answer(
            f"📺 I found **{title}**, but I need the season and episode number.\n"
            f"Example: \"{title} season 2 episode 5\"",
            parse_mode="Markdown",
        )
        return

    if await _present_quality_options(message, intent, user_id):
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
            requested_by=user_id,
            subject_id=result["subject_id"],
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

        clear_session(user_id)

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
            await _handle_download_movie(message, intent, user_id)

        case "download_series":
            await _handle_download_series(message, intent, user_id)

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

@router.callback_query(F.data.startswith("q:"))
async def on_quality_selected(query: CallbackQuery) -> None:
    user_id = query.from_user.id
    quality_label = query.data.split(":", 1)[1]
    
    intent = get_pending_request(user_id)
    if not intent:
        await query.answer("Session expired. Please request again.", show_alert=True)
        return
        
    await query.answer()
    
    # Clean up the inline keyboard message
    await query.message.delete()
    
    intent["quality"] = quality_label
    intent["_quality_selected"] = True
    clear_pending_request(user_id)
    
    if intent["intent"] == "download_movie":
        await _handle_download_movie(query.message, intent, user_id)
    else:
        await _handle_download_series(query.message, intent, user_id)

