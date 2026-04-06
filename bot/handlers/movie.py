"""
/movie <title> command handler — direct movie download.
"""

from __future__ import annotations

import logging

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from services.moviebox import get_movie
from services.link import generate_id, build_url
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from services.supabase import save_media
from services.session import clear_session

logger = logging.getLogger(__name__)
router = Router()


@router.message(Command("movie"))
async def cmd_movie(message: Message) -> None:
    """Handle /movie <title> — direct movie search and download."""
    args = message.text.strip().split(maxsplit=1)

    if len(args) < 2 or not args[1].strip():
        await message.answer(
            "⚠️ Please provide a movie title.\n"
            "Usage: `/movie Avatar`",
            parse_mode="Markdown",
        )
        return

    title = args[1].strip()
    status_msg = await message.answer(f"🔍 Searching for **{title}**...", parse_mode="Markdown")

    try:
        result = await get_movie(title)

        link_id = generate_id()
        link_url = build_url(link_id)

        await save_media(
            link_id=link_id,
            title=result["title"],
            cdn_url=result["cdn_url"],
            media_type="movie",
            quality=result["quality"],
            requested_by=message.from_user.id,
            subject_id=result["subject_id"],
            imdb_id=result.get("imdb_id"),
            poster_url=result.get("poster_url"),
            description=result.get("description"),
        )

        reply = (
            f"🎬 **{result['title']} ({result['year']})**\n"
            f"Quality: {result['quality']}\n\n"
            f"📥 {link_url}\n"
            f"⏳ Link expires in 6 hours"
        )

        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📥 Download Subtitles", callback_data=f"sb:{link_id}")]
        ])

        await status_msg.edit_text(reply, parse_mode="Markdown", reply_markup=kb)

        # Attempt direct file delivery
        try:
            from aiogram.types import URLInputFile
            file_name = f"{result['title']} ({result['year']}) {result['quality']} - SKDL(samkiel.online).mp4"
            await message.answer_document(
                URLInputFile(str(result["cdn_url"]), filename=file_name),
                caption=f"🎬 {result['title']}"
            )
        except Exception as e:
            logger.warning("Direct file delivery failed for '/movie %s': %s", title, e)

        clear_session(message.from_user.id)

    except Exception as exc:
        logger.error("/movie command failed for '%s': %s", title, exc)
        await status_msg.edit_text(
            f"❌ Couldn't find **{title}**. Check the spelling and try again.",
            parse_mode="Markdown",
        )
