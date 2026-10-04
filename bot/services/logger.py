"""
logger.py — Async logging service for bot events.
Writes to Redis `bot_logs` list and updates analytics counters.
"""

import json
import logging
import asyncio
from datetime import datetime, timezone
from services.supabase import get_redis

logger = logging.getLogger(__name__)

async def _do_log_event(
    user_id: int,
    username: str | None,
    display_name: str | None,
    action: str,
    query: str | None = None,
    result_title: str | None = None,
    result_found: bool = False,
    error_message: str | None = None,
    duration_ms: int | None = None,
):
    """Internal implementation of logging a row to Redis."""
    row = {
        "user_id": user_id,
        "username": username,
        "display_name": display_name,
        "action": action,
        "query": query,
        "result_title": result_title,
        "result_found": result_found,
        "error_message": error_message,
        "duration_ms": duration_ms,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        r = get_redis()
        # Keep recent 1000 logs in a capped list
        await r.lpush("bot_logs", json.dumps(row))
        await r.ltrim("bot_logs", 0, 999)

        # Atomic analytics counters
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        await r.incr("stats:total_requests")
        await r.incr(f"stats:requests:{today}")
        await r.pfadd("stats:unique_users", str(user_id))
        await r.pfadd(f"stats:unique_users:{today}", str(user_id))
        if result_found:
            await r.incr("stats:found_requests")
    except Exception as exc:
        # Never raise or block the bot — just log to console
        logger.error("Failed to write to bot_logs in Redis: %s", exc)

def log_event(
    user_id: int,
    username: str | None,
    display_name: str | None,
    action: str,
    query: str | None = None,
    result_title: str | None = None,
    result_found: bool = False,
    error_message: str | None = None,
    duration_ms: int | None = None,
):
    """
    Fire-and-forget logging of a bot event.
    Wraps the async DB call in a task so it doesn't block.
    """
    asyncio.create_task(
        _do_log_event(
            user_id=user_id,
            username=username,
            display_name=display_name,
            action=action,
            query=query,
            result_title=result_title,
            result_found=result_found,
            error_message=error_message,
            duration_ms=duration_ms
        )
    )
