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
from aiogram import Router, F
from aiogram.filters import Command
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from services.moviebox import get_episode
from services.link import generate_id, build_url
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from services.supabase import save_media
from services.session import clear_session

logger = logging.getLogger(__name__)
router = Router()

class SeriesStates(StatesGroup):
    waiting_for_season = State()
    waiting_for_episode = State()

async def process_series_delivery(message: Message, title: str, season: int, episode: int):
    """Helper to handle the actual search and delivery logic."""
    status_msg = await message.answer(
        f"🔍 Searching for **{title}** S{season}E{episode}...", 
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove()
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
            subject_id=result["subject_id"],
            imdb_id=result.get("imdb_id"),
        )

        reply = (
            f"📺 **{result['title']} S{result['season']}E{result['episode']}**\n"
            f"Quality: {result['quality']}\n\n"
            f"📥 {link_url}\n"
            f"⏳ Link expires in 6 hours"
        )

        # Build subtitle button
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📥 Download Subtitles", callback_data=f"sb:{link_id}")]
        ])

        await status_msg.edit_text(reply, parse_mode="Markdown", reply_markup=kb)

        # Attempt direct file delivery
        try:
            from aiogram.types import URLInputFile
            file_name = f"{result['title']} S{result['season']}E{result['episode']} {result['quality']}.mp4"
            await message.answer_document(
                URLInputFile(result["cdn_url"], filename=file_name),
                caption=f"📺 {result['title']} S{result['season']}E{result['episode']}"
            )
        except Exception as e:
            logger.warning("Direct file delivery failed: %s", e)

    except Exception as exc:
        logger.error("Series search failed for '%s' S%dE%d: %s", title, season, episode, exc)
        await status_msg.edit_text(
            f"❌ Couldn't find **{title}** S{season}E{episode}. Check the details and try again.",
            parse_mode="Markdown",
        )

@router.message(Command("series"))
async def cmd_series(message: Message, state: FSMContext) -> None:
    """Handle /series — starts interactive flow or processes one-shot command."""
    args = message.text.strip().split()

    # One-shot case: /series Title 2 3
    if len(args) >= 4:
        try:
            episode = int(args[-1])
            season = int(args[-2])
            title = " ".join(args[1:-2])
            await process_series_delivery(message, title, season, episode)
            return
        except ValueError:
            pass # Fallback to interactive if parse fails

    # Interactive flow
    title = " ".join(args[1:])
    if not title:
        await message.answer("🍿 Which series are we watching? (e.g. `/series Fleabag`)", parse_mode="Markdown")
        return

    await state.update_data(title=title)
    await state.set_state(SeriesStates.waiting_for_season)
    
    # Simple reply keyboard for seasons
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="1"), KeyboardButton(text="2"), KeyboardButton(text="3")],
            [KeyboardButton(text="4"), KeyboardButton(text="5"), KeyboardButton(text="6")]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )
    
    await message.answer(
        f"🎬 **{title}**! Love it.\nWhich season are we aiming for? (Type a number)",
        reply_markup=kb,
        parse_mode="Markdown"
    )

@router.message(SeriesStates.waiting_for_season)
async def handle_season(message: Message, state: FSMContext):
    """Capture season and ask for episode."""
    try:
        season = int(message.text)
        await state.update_data(season=season)
        await state.set_state(SeriesStates.waiting_for_episode)
        
        # Simple reply keyboard for common episodes
        kb = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text="1"), KeyboardButton(text="2"), KeyboardButton(text="3")],
                [KeyboardButton(text="4"), KeyboardButton(text="5"), KeyboardButton(text="6")]
            ],
            resize_keyboard=True,
            one_time_keyboard=True
        )

        await message.answer(
            f"⚡️ Nice. Season {season} it is!\nAnd which episode are we diving into?",
            reply_markup=kb
        )
    except ValueError:
        await message.answer("⚠️ Oops! Send me a number for the season.")

@router.message(SeriesStates.waiting_for_episode)
async def handle_episode(message: Message, state: FSMContext):
    """Capture episode and start delivery."""
    try:
        episode = int(message.text)
        data = await state.get_data()
        title = data['title']
        season = data['season']
        
        await state.clear()
        await process_series_delivery(message, title, season, episode)
    except ValueError:
        await message.answer("⚠️ Oops! Send me a number for the episode.")
