"""
scraper.py — Free web stream scraper fallback using IMDb ID resolution and universal web embed providers.

Flow:
1. When MovieBox cannot fulfill a title, resolve IMDb ID & poster via IMDb Suggestion API.
2. Construct embed stream URL (AutoEmbed / 2Embed) for movies and TV series.
3. Return standardized media dictionary compatible with save_media and web player.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
import aiohttp

logger = logging.getLogger(__name__)


def _clean_query(title: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9 ]+", " ", title or "").strip()
    return re.sub(r"\s+", " ", cleaned)


async def search_free_scraper(
    title: str,
    is_series: bool = False,
    season: int = 1,
    episode: int = 1
) -> dict | None:
    """
    Search public IMDb index and construct a free web stream embed link.
    """
    clean_title = _clean_query(title)
    if not clean_title:
        return None

    # Slugify first character/prefix for IMDb suggestion endpoint: /suggestion/{first_char}/{query}.json
    slug = clean_title.lower()
    first_char = slug[0] if slug[0].isalnum() else "a"
    encoded_query = urllib.parse.quote(slug.replace(" ", "_"))
    url = f"https://v3.sg.media-imdb.com/suggestion/{first_char}/{encoded_query}.json"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6)) as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    logger.debug("[scraper] IMDb suggest returned status %s", resp.status)
                    return None
                data = await resp.json()
                items = data.get("d", []) or []

        if not items:
            return None

        # Filter candidates by type (feature film vs TV series)
        target_item = None
        for item in items:
            q_type = (item.get("q") or "").lower()
            if not item.get("id", "").startswith("tt"):
                continue

            if is_series:
                if any(k in q_type for k in ("tv series", "tv mini series", "series")):
                    target_item = item
                    break
            else:
                if any(k in q_type for k in ("feature", "movie", "tv movie")):
                    target_item = item
                    break

        # Fallback to the first item with a valid IMDb ID if no strict type match
        if not target_item:
            target_item = next((it for it in items if it.get("id", "").startswith("tt")), None)

        if not target_item:
            return None

        imdb_id = target_item["id"]
        canonical_title = target_item.get("l") or title
        year = target_item.get("y") or 2026
        poster_url = target_item.get("i", {}).get("imageUrl")

        # Construct stream embed URL
        if is_series:
            embed_url = f"https://player.autoembed.cc/embed/tv/{imdb_id}/{season}/{episode}"
        else:
            embed_url = f"https://player.autoembed.cc/embed/movie/{imdb_id}"

        logger.info("[scraper] Successfully resolved free stream for '%s' -> %s (%s)", title, canonical_title, imdb_id)

        return {
            "cdn_url": embed_url,
            "title": canonical_title,
            "year": year,
            "quality": "HD Web Stream",
            "size": 0,
            "subject_id": None,
            "imdb_id": imdb_id,
            "poster_url": poster_url,
            "description": f"Streamed via Free Web Stream Provider (IMDb: {imdb_id})",
            "is_embed": True,
        }

    except Exception as exc:
        logger.error("[scraper] Free stream resolution failed for '%s': %s", title, exc)
        return None
