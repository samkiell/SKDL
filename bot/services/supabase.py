"""
Redis service — replaces Supabase for media storage, collections, rate-limiting, and heartbeats.
Kept under supabase.py for seamless backward compatibility with all handlers.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

import redis.asyncio as aioredis
from config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            health_check_interval=30,
        )
    return _redis_client


# For backwards compatibility with code importing _client
class RedisTableShim:
    """Shim to avoid breaking any legacy code expecting _client.table() syntax."""
    def table(self, name: str):
        return self
    def insert(self, *args, **kwargs):
        return self
    def upsert(self, *args, **kwargs):
        return self
    def execute(self):
        return type("Resp", (), {"data": []})()

_client = RedisTableShim()


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
    poster_url: str | None = None,
    description: str | None = None,
) -> dict | None:
    """
    Store media metadata in Redis with TTL.
    Returns the stored dict or None on failure.
    """
    now = datetime.now(timezone.utc).isoformat()
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
        "requested_at": now,
        "created_at": now,
        "expires_at": expires_at.isoformat(),
        "subject_id": subject_id,
        "imdb_id": imdb_id,
        "poster_url": poster_url,
        "description": description,
    }

    try:
        r = get_redis()
        ttl_seconds = settings.CDN_TTL_HOURS * 3600
        # Save key with expiration
        await r.set(f"media:{link_id}", json.dumps(row), ex=ttl_seconds)
        # Add to recent media list
        await r.lpush("media:recent", json.dumps(row))
        await r.ltrim("media:recent", 0, 199)
        await r.incr("stats:total_media")
        return row
    except Exception as exc:
        logger.error("Redis save_media failed for id=%s: %s", link_id, exc)
        return None


async def get_media(link_id: str) -> dict | None:
    """Look up media metadata by ID from Redis."""
    try:
        r = get_redis()
        data = await r.get(f"media:{link_id}")
        if data:
            return json.loads(data)
        return None
    except Exception as exc:
        logger.error("Redis get_media failed for id=%s: %s", link_id, exc)
        return None


async def get_media_by_id(link_id: str) -> dict | None:
    """Helper alias for get_media."""
    return await get_media(link_id)


async def save_collection(
    collection_id: str,
    title: str,
    season: int,
    media_ids: list[str],
    requested_by: int | None = None,
) -> dict | None:
    """Store bulk season collection in Redis with TTL."""
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
        r = get_redis()
        ttl_seconds = settings.CDN_TTL_HOURS * 3600
        await r.set(f"collection:{collection_id}", json.dumps(row), ex=ttl_seconds)
        return row
    except Exception as exc:
        logger.error("Redis save_collection failed for id=%s: %s", collection_id, exc)
        return None


async def get_collection(collection_id: str) -> dict | None:
    """Look up a collection by ID from Redis."""
    try:
        r = get_redis()
        data = await r.get(f"collection:{collection_id}")
        if data:
            return json.loads(data)
        return None
    except Exception as exc:
        logger.error("Redis get_collection failed for id=%s: %s", collection_id, exc)
        return None


async def check_rate_limit(user_id: int, limit: int = 10) -> bool:
    """
    Check if a user has exceeded their daily quota.
    Atomic Redis INCR with 24h key expiration.
    Returns True if allowed, False if exceeded. Fails open on error.
    """
    try:
        r = get_redis()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        key = f"ratelimit:{user_id}:{today}"
        count = await r.incr(key)
        if count == 1:
            await r.expire(key, 86400)
        return count <= limit
    except Exception as exc:
        logger.error("Redis rate limit check failed for user_id=%s: %s", user_id, exc)
        return True


async def update_bot_heartbeat() -> None:
    """
    Update the bot heartbeat entry in Redis.
    Sets key with 120s TTL for automatic offline detection.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        r = get_redis()
        await r.set("bot:heartbeat", now, ex=120)
        await r.set("settings:bot_heartbeat", now)
    except Exception as exc:
        logger.error("Bot heartbeat update failed: %s", exc)
