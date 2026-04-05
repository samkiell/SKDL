"""
subtitle.py — Callback handler for subtitle downloads.
"""

import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, URLInputFile

from services.moviebox import get_subtitles
from services.opensubtitles import search_subtitles, download_subtitle, find_best_match

logger = logging.getLogger(__name__)
router = Router()

from services.supabase import get_media_by_id
from aiogram.filters import Command
from aiogram.types import Message

@router.message(Command("sub"))
async def cmd_sub(message: Message):
    """Handle /sub <title> manual command."""
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        return await message.answer("⚠️ Usage: `/sub Avatar 2022`", parse_mode="Markdown")
    await cmd_sub_search(message, args[1])


async def cmd_sub_search(message: Message, query: str):
    """Internal helper to search and send subs."""
    status = await message.answer(f"🔍 Searching subtitles for **{query}**...", parse_mode="Markdown")
    try:
        from services.opensubtitles import search_subtitles, download_subtitle, find_best_match
        os_subs = await search_subtitles(query=query)
        best = find_best_match(os_subs)
        if best:
            file_id = best["attributes"]["files"][0]["file_id"]
            download_res = await download_subtitle(file_id)
            if download_res and download_res.get("link"):
                await message.answer_document(
                    URLInputFile(download_res["link"], filename=download_res.get("file_name", "sub.srt")),
                    caption=f"📥 Subtitles for **{query}**"
                )
                await status.delete()
                return
        await status.edit_text(f"❌ No English subtitles found for **{query}**.")
    except Exception as e:
        logger.error("Subtitle search failed: %s", e)
        await status.edit_text("❌ Subtitle search failed.")


@router.callback_query(F.data.startswith("sb:"))
async def handle_subtitle_callback(callback: CallbackQuery):
    """Process subtitle download request via link_id."""
    await callback.answer("🔍 Searching...")
    try:
        link_id = callback.data.split(":")[2] if ":" in callback.data else "" # handle legacy it parts
        # If parts[1] is 0 or 1, it's the old format. 
        # But I'll just change the buttons to send sb:{link_id}
        parts = callback.data.split(":")
        
        target_id = parts[1] # New format: sb:{link_id}
        media = await get_media_by_id(target_id)
        if not media:
            return await callback.message.answer("❌ This link has expired.")
        
        await cmd_sub_search(callback.message, f"{media['title']} {media.get('quality', '')}")
    except Exception as exc:
        logger.error("Subtitle callback failed: %s", exc)
