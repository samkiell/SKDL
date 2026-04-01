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
