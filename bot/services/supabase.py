"""
Supabase service — all database reads and writes against the `media` table.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from supabase import create_client, Client

from config import settings

logger = logging.getLogger(__name__)

_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


async def save_media(
    link_id: str,
    title: str,
    cdn_url: str,
    media_type: str,
    quality: str = "1080p",
    season: int | None = None,
    episode: int | None = None,
    requested_by: int | None = None,
    subject_id: str | None = None,
    imdb_id: str | None = None,
) -> dict | None:
    """
    Insert a new row into the media table.
    Returns the inserted row dict or None on failure.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.CDN_TTL_HOURS)

    row = {
        "id": link_id,
        "title": title,
        "cdn_url": cdn_url,
        "type": media_type,
        "quality": quality,
        "season": season,
        "episode": episode,
        "requested_by": requested_by,
        "expires_at": expires_at.isoformat(),
        "subject_id": subject_id,
        "imdb_id": imdb_id,
    }

    try:
        result = _client.table("media").insert(row).execute()
        if result.data:
            return result.data[0]
        logger.error("Supabase insert returned no data for id=%s", link_id)
        return None
    except Exception as exc:
        logger.error("Supabase insert failed for id=%s: %s", link_id, exc)
        return None


async def get_media(link_id: str) -> dict | None:
    """
    Look up a media row by ID.
    Returns the row dict or None if not found / on error.
    """
    try:
        result = _client.table("media").select("*").eq("id", link_id).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as exc:
        logger.error("Supabase lookup failed for id=%s: %s", link_id, exc)
        return None

async def save_collection(
    collection_id: str,
    title: str,
    season: int,
    media_ids: list[str],
    requested_by: int | None = None,
) -> dict | None:
    """Insert a bulk season collection into the collections table."""
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.CDN_TTL_HOURS)
    row = {
        "id": collection_id,
        "title": title,
        "season": season,
        "media_ids": media_ids,
        "requested_by": requested_by,
        "expires_at": expires_at.isoformat(),
    }
    try:
        result = _client.table("collections").insert(row).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as exc:
        logger.error("Supabase insert failed for collection_id=%s: %s", collection_id, exc)
        return None

async def get_collection(collection_id: str) -> dict | None:
    """Look up a collection by ID."""
    try:
        result = _client.table("collections").select("*").eq("id", collection_id).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as exc:
        logger.error("Supabase lookup failed for collection_id=%s: %s", collection_id, exc)
        return None

async def check_rate_limit(user_id: int, limit: int = 10) -> bool:
    """
    Check if a user has exceeded their daily quota.
    Returns True if allowed, False if exceeded. Fails open on error.
    """
    now = datetime.now(timezone.utc)
    try:
        res = _client.table("rate_limits").select("*").eq("user_id", user_id).execute()
        if res.data and len(res.data) > 0:
            row = res.data[0]
            # Handle potential 'Z' in isoformat from Supabase
            reset_at_str = row["reset_at"].replace("Z", "+00:00")
            reset_at = datetime.fromisoformat(reset_at_str)
            
            if now > reset_at:
                # Reset window
                _client.table("rate_limits").update({
                    "request_count": 1,
                    "last_request": now.isoformat(),
                    "reset_at": (now + timedelta(days=1)).isoformat()
                }).eq("user_id", user_id).execute()
                return True
            
            if row["request_count"] >= limit:
                return False
                
            _client.table("rate_limits").update({
                "request_count": row["request_count"] + 1,
                "last_request": now.isoformat()
            }).eq("user_id", user_id).execute()
            return True
        else:
            # First time user
            _client.table("rate_limits").insert({
                "user_id": user_id,
                "request_count": 1,
                "last_request": now.isoformat(),
                "reset_at": (now + timedelta(days=1)).isoformat()
            }).execute()
            return True
    except Exception as exc:
        logger.error("Rate limit check failed for user_id=%s: %s", user_id, exc)
        return True # Fail open so users aren't blocked on DB issues
async def get_media_by_id(link_id: str) -> dict | None:
    """Helper for the bot to get full metadata by link_id."""
    try:
        result = _client.table("media").select("*").eq("id", link_id).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None


async def update_bot_heartbeat() -> None:
    """
    Update the bot_heartbeat entry in the settings table.
    Used by Lighthouse to determine if the bot is online.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        # We use an upsert on the settings table where key='bot_heartbeat'
        _client.table("settings").upsert({
            "key": "bot_heartbeat",
            "value": now,
            "updated_at": now
        }, on_conflict="key").execute()
    except Exception as exc:
        logger.error("Bot heartbeat update failed: %s", exc)
