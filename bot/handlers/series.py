"""
/series <title> <season> <episode> command handler — direct series episode download.
"""

from __future__ import annotations

import logging

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from services.moviebox import get_episode
from services.link import generate_id, build_url
from services.supabase import save_media
from services.session import clear_session

logger = logging.getLogger(__name__)
router = Router()


@router.message(Command("series"))
async def cmd_series(message: Message) -> None:
    """Handle /series <title> <season> <episode> — direct series episode download."""
    args = message.text.strip().split()

    # Expect: /series Title Words Here 2 3
    # Minimum: /series <title> <season> <episode> → at least 4 tokens
    if len(args) < 4:
        await message.answer(
            "⚠️ Please provide title, season, and episode.\n"
            "Usage: `/series Breaking Bad 2 3`",
            parse_mode="Markdown",
        )
        return

    try:
        # Last two args are season and episode
        episode = int(args[-1])
        season = int(args[-2])
        title = " ".join(args[1:-2])
    except ValueError:
        await message.answer(
            "⚠️ Season and episode must be numbers.\n"
            "Usage: `/series Breaking Bad 2 3`",
            parse_mode="Markdown",
        )
        return

    if not title:
        await message.answer(
            "⚠️ Please provide a series title.\n"
            "Usage: `/series Breaking Bad 2 3`",
            parse_mode="Markdown",
        )
        return

    status_msg = await message.answer(
        f"🔍 Searching for **{title}** S{season}E{episode}...", parse_mode="Markdown"
    )

    try:
        result = await get_episode(title, season, episode)

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
            logger.warning("Direct file delivery failed for '/series %s': %s", title, e)

        clear_session(message.from_user.id)

    except Exception as exc:
        logger.error("/series command failed for '%s' S%dE%d: %s", title, season, episode, exc)
        await status_msg.edit_text(
            f"❌ Couldn't find **{title}** S{season}E{episode}. Check the details and try again.",
            parse_mode="Markdown",
        )
