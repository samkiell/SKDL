"""
torbox.py — Torbox Debrid fallback service for cached torrent un-restricting.

Flow:
1. When MovieBox yields 0 results, search public torrent indexes (YTS, public tracker scrapers).
2. Query Torbox API to check if torrent hash is instantly cached.
3. If cached, create torrent on Torbox and request unthrottled direct HTTPS stream URL.
4. Return standardized media dictionary compatible with save_media and player routes.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
import aiohttp

from config import settings

logger = logging.getLogger(__name__)

TORBOX_API_BASE = "https://api.torbox.app/v1/api"


def _extract_hash(magnet: str) -> str | None:
    match = re.search(r"urn:btih:([a-zA-Z0-9]{32,40})", magnet, re.IGNORECASE)
    return match.group(1).lower() if match else None


async def _search_public_torrents(title: str, year: int | None = None) -> list[dict]:
    """Search public indexes (e.g. YTS) for magnet links and hashes."""
    results = []
    clean_title = re.sub(r"[^a-zA-Z0-9 ]+", " ", title).strip()
    query = f"{clean_title} {year}".strip() if year else clean_title

    # 1. YTS Movie API (fast, reliable metadata & clean hashes)
    try:
        url = f"https://yts.mx/api/v2/list_movies.json?query_term={urllib.parse.quote(query)}&limit=5"
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    movies = data.get("data", {}).get("movies", []) or []
                    for m in movies:
                        for tor in m.get("torrents", []):
                            thash = tor.get("hash")
                            if thash:
                                quality = tor.get("quality", "1080p")
                                size_bytes = tor.get("size_bytes", 0)
                                magnet = (
                                    f"magnet:?xt=urn:btih:{thash}&dn={urllib.parse.quote(m.get('title', title))}"
                                    f"&tr=udp://open.demonii.com:1337/announce"
                                    f"&tr=udp://tracker.openbittorrent.com:80"
                                )
                                results.append({
                                    "title": m.get("title", title),
                                    "year": m.get("year", year or 2026),
                                    "hash": thash.lower(),
                                    "magnet": magnet,
                                    "quality": quality,
                                    "size": size_bytes,
                                })
    except Exception as e:
        logger.debug("[torbox] YTS index search failed: %s", e)

    return results


async def check_torbox_cache(hashes: list[str]) -> set[str]:
    """Check which hashes are currently cached on Torbox."""
    api_key = settings.TORBOX_API_KEY
    if not api_key or not hashes:
        return set()

    hash_str = ",".join(hashes)
    url = f"{TORBOX_API_BASE}/torrents/checkcached?hash={hash_str}&format=object"
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    cached_map = data.get("data", {}) or {}
                    return {h.lower() for h, val in cached_map.items() if val}
    except Exception as e:
        logger.warning("[torbox] Cache check failed: %s", e)

    return set()


async def get_torbox_stream(magnet: str, file_title: str) -> dict | None:
    """Add cached torrent to Torbox and retrieve direct download link."""
    api_key = settings.TORBOX_API_KEY
    if not api_key:
        return None

    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            # Step 1: Create/Add torrent
            create_url = f"{TORBOX_API_BASE}/torrents/createtorrent"
            form_data = aiohttp.FormData()
            form_data.add_field("magnet", magnet)
            form_data.add_field("seed", "1")

            async with session.post(create_url, data=form_data, headers=headers) as resp:
                if resp.status not in (200, 201):
                    logger.warning("[torbox] Create torrent failed: %s", resp.status)
                    return None
                data = await resp.json()
                torrent_id = data.get("data", {}).get("torrent_id")

            if not torrent_id:
                return None

            # Step 2: Fetch torrent info to find main video file ID
            info_url = f"{TORBOX_API_BASE}/torrents/mylist?id={torrent_id}"
            async with session.get(info_url, headers=headers) as resp:
                if resp.status != 200:
                    return None
                t_data = await resp.json()
                torrent_info = t_data.get("data", {})
                files = torrent_info.get("files", []) or []

            if not files:
                return None

            # Pick largest video file
            video_files = [
                f for f in files 
                if any(f.get("name", "").lower().endswith(ext) for ext in (".mp4", ".mkv", ".webm", ".avi"))
            ]
            target_file = max(video_files or files, key=lambda f: f.get("size", 0))
            file_id = target_file.get("id")

            # Step 3: Request Direct Download Link
            dl_url = f"{TORBOX_API_BASE}/torrents/requestdl?token={api_key}&torrent_id={torrent_id}&file_id={file_id}&zip=false"
            async with session.get(dl_url, headers=headers) as resp:
                if resp.status == 200:
                    dl_data = await resp.json()
                    direct_url = dl_data.get("data")
                    if direct_url:
                        return {
                            "cdn_url": direct_url,
                            "size": target_file.get("size", 0),
                        }

    except Exception as e:
        logger.error("[torbox] Stream extraction failed for '%s': %s", file_title, e)

    return None


async def resolve_torbox_fallback(title: str, year: int | None = None) -> dict | None:
    """
    Search and resolve high-speed direct stream link via Torbox Debrid cache.
    Returns media dictionary compatible with save_media, or None.
    """
    if not settings.TORBOX_API_KEY:
        return None

    logger.info("[torbox] Attempting Torbox cache fallback for '%s'...", title)
    torrents = await _search_public_torrents(title, year)
    if not torrents:
        return None

    hashes = [t["hash"] for t in torrents if t.get("hash")]
    cached_hashes = await check_torbox_cache(hashes)

    for item in torrents:
        if item["hash"] in cached_hashes:
            logger.info("[torbox] Found cached torrent: %s (%s)", item["title"], item["quality"])
            res = await get_torbox_stream(item["magnet"], item["title"])
            if res and res.get("cdn_url"):
                return {
                    "cdn_url": res["cdn_url"],
                    "title": item["title"],
                    "year": item.get("year", year or 2026),
                    "quality": item.get("quality", "1080p"),
                    "size": res.get("size") or item.get("size", 0),
                    "subject_id": None,
                    "poster_url": None,
                    "description": "Streamed via Torbox High-Speed Debrid Cache",
                }

    logger.info("[torbox] No cached torrents available for '%s'", title)
    return None
