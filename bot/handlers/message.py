"""
Message handler — catches all non-command text.
Routes through Groq AI for intent parsing, then dispatches accordingly.
This router MUST be registered last in main.py.
"""

from __future__ import annotations

import logging
import base64
import time
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, PhotoSize
from aiogram.utils.keyboard import InlineKeyboardBuilder
from services.logger import log_event

from services.groq_service import parse_intent
from services.session import (
    add_message, get_history, clear_session,
    set_pending_request, get_pending_request, clear_pending_request
)
from services.moviebox import get_movie, get_episode, get_available_qualities
from services.link import generate_id, build_url
from services.supabase import save_media, save_collection, check_rate_limit

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
    
    display_title = data.get('title', title)
    if is_series and season is not None and episode is not None:
        display_title += f" S{season}E{episode}"
        
    await status_msg.edit_text(
        f"✅ Found **{display_title}**.\nChoose your quality 👇",
        reply_markup=builder.as_markup(),
        parse_mode="Markdown"
    )
    return True


async def _handle_download_movie(message: Message, intent: dict, user_id: int, start_time: float) -> None:
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

        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        log_event(
            user_id=user_id,
            username=message.from_user.username,
            display_name=message.from_user.full_name,
            action="download_movie",
            query=intent.get("title"),
            result_title=result["title"],
            result_found=True,
            duration_ms=elapsed_ms,
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
            file_name = f"{result['title']} ({result['year']}) {result['quality']} - SKDL(samkiel.online).mp4"
            await message.answer_document(
                URLInputFile(result["cdn_url"], filename=file_name),
                caption=f"🎬 {result['title']}"
            )
        except Exception as e:
            logger.warning("Direct file delivery failed for '%s': %s", result['title'], e)
            # We don't notify the user because the link is the primary delivery method

        add_message(user_id, "assistant", f"I just successfully generated a download link and sent the movie: {result['title']} ({result['year']}) in {result['quality']}.")
        clear_pending_request(user_id)

    except Exception as exc:
        logger.error("Movie download failed: %s", exc)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        
        # Check if it was a "not found" vs a technical error
        is_not_found = "No results found" in str(exc) or "Could not resolve" in str(exc)
        
        log_event(
            user_id=user_id,
            username=message.from_user.username,
            display_name=message.from_user.full_name,
            action="not_found" if is_not_found else "error",
            query=intent.get("title"),
            result_found=False,
            error_message=None if is_not_found else str(exc),
            duration_ms=elapsed_ms,
        )

        await status_msg.edit_text(
            f"❌ Couldn't find or process **{intent.get('title')}**. Try a different title or check the spelling.",
            parse_mode="Markdown",
        )


async def _handle_download_series(message: Message, intent: dict, user_id: int, start_time: float) -> None:
    """Process a download_series intent."""
    title = intent.get("title")
    season = intent.get("season")
    episode = intent.get("episode")

    if not title:
        await message.answer("🤔 I couldn't figure out the series title. Could you be more specific?")
        return

    if intent.get("bulk") and season is not None:
        await _handle_bulk_series(message, intent, user_id, start_time)
        return

    if season is None or episode is None:
        # Build buttons for episodes if only episode is missing
        builder = InlineKeyboardBuilder()
        if season is not None and episode is None:
            for i in range(1, 9):
                builder.button(text=f"Ep {i}", callback_data=f"ep:{i}")
            # Add 'Whole Season' as the final button
            builder.button(text="📂 Whole Season", callback_data="ep:bulk")
            builder.adjust(4, 1)
        
        # Use AI's chat response for natural tone, fallback if it's missing
        chat_reply = intent.get("chat_response")
        if not chat_reply or "example:" in chat_reply.lower():
            if season is None:
                chat_reply = f"I found **{title}**! Which season are we aiming for?"
            else:
                chat_reply = f"Dope, **{title}** Season {season}. Which episode are we diving into?"

        set_pending_request(user_id, intent)
        await message.answer(
            chat_reply,
            reply_markup=builder.as_markup() if (season is not None and episode is None) else None,
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

        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        log_event(
            user_id=user_id,
            username=message.from_user.username,
            display_name=message.from_user.full_name,
            action="download_series",
            query=f"{intent.get('title')} S{season}E{episode}",
            result_title=result["title"],
            result_found=True,
            duration_ms=elapsed_ms,
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
            file_name = f"{result['title']} S{result['season']}E{result['episode']} {result['quality']} - SKDL(samkiel.online).mp4"
            await message.answer_document(
                URLInputFile(result["cdn_url"], filename=file_name),
                caption=f"📺 {result['title']} S{result['season']}E{result['episode']}"
            )
        except Exception as e:
            logger.warning("Direct file delivery failed for series '%s': %s", result['title'], e)

        add_message(user_id, "assistant", f"I just successfully generated a download link and sent the series episode: {result['title']} Season {result['season']} Episode {result['episode']} in {result['quality']}.")
        clear_pending_request(user_id)

    except Exception as exc:
        logger.error("Series download failed: %s", exc)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        
        is_not_found = "No series results found" in str(exc) or "No results found" in str(exc) or "Could not resolve" in str(exc)
        
        log_event(
            user_id=user_id,
            username=message.from_user.username,
            display_name=message.from_user.full_name,
            action="not_found" if is_not_found else "error",
            query=f"{intent.get('title')} S{season}E{episode}",
            result_found=False,
            error_message=None if is_not_found else str(exc),
            duration_ms=elapsed_ms,
        )

        await status_msg.edit_text(
            f"❌ Couldn't find **{intent.get('title')}** S{season}E{episode}. Check the title and episode number.",
            parse_mode="Markdown",
        )


async def _handle_bulk_series(message: Message, intent: dict, user_id: int, start_time: float) -> None:
    """Process a bulk series download (entire season)."""
    title = intent.get("title")
    season = intent.get("season")
    quality = intent.get("quality") or "1080p"

    # 1. Update user - it's a long task
    status_msg = await message.answer(
        f"🌪️ Gathering all of **{title}** Season {season} at {quality} quality...\n"
        f"This might take about 15-20 seconds. 🍿",
        parse_mode="Markdown"
    )

    try:
        from services.moviebox import get_season_episodes
        episodes = await get_season_episodes(title, season, quality)

        if not episodes:
            await status_msg.edit_text(f"❌ Couldn't find any episodes for Season {season} of **{title}**.")
            return

        # 2. Save each episode to the media table & collect IDs
        media_ids = []
        for ep in episodes:
            link_id = generate_id()
            await save_media(
                link_id=link_id,
                title=ep["title"],
                cdn_url=ep["cdn_url"],
                media_type="series",
                quality=ep["quality"],
                season=ep["season"],
                episode=ep["episode"],
                requested_by=user_id,
                subject_id=ep["subject_id"],
            )
            media_ids.append(link_id)

        # 3. Create a collection
        collection_id = generate_id()
        await save_collection(
            collection_id=collection_id,
            title=episodes[0]["title"],
            season=season,
            media_ids=media_ids,
            requested_by=user_id
        )

        collection_url = f"{settings.WEB_PROXY_BASE_URL}/collection/{collection_id}"

        reply = (
            f"✅ **Season Complete!**\n\n"
            f"📺 **{episodes[0]['title']} — Season {season}**\n"
            f"📦 Total: {len(episodes)} episodes\n\n"
            f"📥 {collection_url}\n"
            f"⏳ Link expires in 6 hours"
        )

        await status_msg.edit_text(reply, parse_mode="Markdown")
        add_message(user_id, "assistant", f"I just successfully generated a bulk download collection for {episodes[0]['title']} Season {season}.")
        
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        log_event(
            user_id=user_id,
            username=message.from_user.username,
            display_name=message.from_user.full_name,
            action="download_series",
            query=f"{intent.get('title')} Season {season} (Bulk)",
            result_title=episodes[0]["title"],
            result_found=True,
            duration_ms=elapsed_ms,
        )

    except Exception as exc:
        logger.error("Bulk series download failed for '%s': %s", title, exc)
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        
        log_event(
            user_id=user_id,
            username=message.from_user.username,
            display_name=message.from_user.full_name,
            action="error",
            query=f"{intent.get('title')} Season {season} (Bulk)",
            result_found=False,
            error_message=str(exc),
            duration_ms=elapsed_ms,
        )

        await status_msg.edit_text(
            f"❌ Something went wrong while fetching the whole season. Try requesting a single episode or check back later.",
            parse_mode="Markdown",
        )


@router.message(F.text | F.photo)
async def handle_message(message: Message) -> None:
    """Catch-all message handler — routes through Groq AI for both text and images."""
    start_time = time.monotonic()
    if not message.text and not message.photo and not message.caption:
        return

    user_id = message.from_user.id
    user_text = message.text or message.caption or "What movie or series is in this image?"
    user_text = user_text.strip()
    
    image_base64 = None
    
    if message.photo:
        # Get the highest resolution photo
        highest_res_photo: PhotoSize = message.photo[-1]
        
        try:
            # Tell user we are looking at the image
            status_msg = await message.answer("👁️ Looking at your image...")
            
            # Download file from Telegram servers
            file_info = await message.bot.get_file(highest_res_photo.file_id)
            downloaded_file = await message.bot.download_file(file_info.file_path)
            
            # Encode downloaded bytes to base64
            image_base64 = base64.b64encode(downloaded_file.getvalue()).decode('utf-8')
            
            await status_msg.delete()
        except Exception as e:
            logger.error("Failed to process image: %s", e)
            await message.answer("⚠️ I couldn't standardise your image, sorry! Can you just type the name?")
            return

    # Store user message in session
    add_message(user_id, "user", "[Sent an Image]" if message.photo else user_text)

    # Get intent from Groq
    history = get_history(user_id)
    intent = await parse_intent(history, user_text, image_base64=image_base64)

    match intent["intent"]:
        case "download_movie":
            username = (message.from_user.username or "").lower()
            if username not in ["samkiell", "samkiel488"] and not await check_rate_limit(user_id):
                await message.answer("⚠️ whoa there big watcher, you've hit your daily limit of 10 movies. touch some grass and try again tomorrow!")
                return
            await _handle_download_movie(message, intent, user_id, start_time)

        case "download_series":
            username = (message.from_user.username or "").lower()
            if username not in ["samkiell", "samkiel488"] and not await check_rate_limit(user_id):
                await message.answer("⚠️ whoa there binge-watcher, you've hit your daily limit of 10 episodes. touch some grass and try again tomorrow!")
                return
            await _handle_download_series(message, intent, user_id, start_time)

        case "clarify":
            clarify_msg = intent.get("clarify_message") or "Could you give me more details?"
            add_message(user_id, "assistant", clarify_msg)
            await message.answer(f"🤔 {clarify_msg}")
            
            elapsed_ms = int((time.monotonic() - start_time) * 1000)
            log_event(
                user_id=user_id,
                username=message.from_user.username,
                display_name=message.from_user.full_name,
                action="clarification",
                query=user_text,
                result_found=False,
                duration_ms=elapsed_ms,
            )

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
        await _handle_download_movie(query.message, intent, user_id, time.monotonic())
    else:
        await _handle_download_series(query.message, intent, user_id, time.monotonic())

@router.callback_query(F.data.startswith("ep:"))
async def on_episode_selected(query: CallbackQuery) -> None:
    user_id = query.from_user.id
    val = query.data.split(":")[1]
    
    intent = get_pending_request(user_id)
    if not intent:
        await query.answer("Session expired. Please request again.", show_alert=True)
        return
        
    await query.answer()
    await query.message.delete()
    
    if val == "bulk":
        intent["bulk"] = True
        intent["intent"] = "download_series"
        intent["episode"] = None # Clear any partial episode data
    else:
        intent["episode"] = int(val)
        intent["bulk"] = False
        intent["intent"] = "download_series"

    clear_pending_request(user_id)
    await _handle_download_series(query.message, intent, user_id, time.monotonic())

