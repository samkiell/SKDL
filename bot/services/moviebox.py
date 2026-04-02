"""
moviebox.py — CDN URL extraction from moviebox-api without downloading.

=== moviebox-api internals investigation (Simatwa/moviebox-api on GitHub) ===

CDN URL resolution chain discovered by reading the source at
https://github.com/Simatwa/moviebox-api/tree/main/src/moviebox_api/v1

The library resolves CDN URLs in this order:

1. Search(session, query, subject_type).get_content_model()
   -> Returns SearchResultsModel containing SearchResultsItem objects.
   -> Each item has subjectId, title, releaseDate, etc.

2. DownloadableMovieFilesDetail / DownloadableTVSeriesFilesDetail
    -> Resolves downloadable metadata from moviebox session context.
    -> Uses season/episode coordinates for series requests.

3. resolve_media_file_to_be_downloaded(quality, downloadable_metadata)
   -> Picks the MediaFileMetadata matching the requested quality.
   -> For "BEST": returns downloadable_metadata.best_media_file (highest resolution)
   -> For specific quality: uses get_quality_downloads_map()

4. MediaFileMetadata model (pydantic):
   - id: str
   - url: HttpUrl        <--- THIS IS THE CDN URL we need
   - resolution: int     (e.g. 1080, 720, 480)
   - size: int           (file size in bytes)

5. MediaFileDownloader.run() calls ThrottleBuster with str(media_file.url)
   -> This is where bytes are actually written to disk.
   -> We stop at step 4 — we have the CDN URL without downloading.

APPROACH: Search with moviebox-api, then resolve downloadable metadata
through SDK detail endpoints and return CDN URLs without invoking any
file downloader.

For series: DownloadableTVSeriesFilesDetail inherits from
BaseDownloadableFilesDetail and uses get_content_model(season, episode)
with the season/episode params passed through.
"""

from __future__ import annotations

import logging
from urllib.parse import quote

import httpx

from moviebox_api.v1 import (
    Search,
    Session,
)
from moviebox_api.v1.constants import SubjectType

from config import settings

logger = logging.getLogger(__name__)

# Override moviebox host if configured
import os
os.environ.setdefault("MOVIEBOX_API_HOST_V2", settings.MOVIEBOX_API_HOST_V2)

AONEROOM_DOWNLOAD_URL = "https://h5.aoneroom.com/wefeed-h5-bff/web/subject/download"
PROXY_DOWNLOAD_BASE = "https://samkiel.online/api/proxy"

def _normalize_quality(quality: str) -> str:
    """Convert quality string to moviebox-api format (e.g. '1080p' -> '1080P')."""
    q = quality.strip().upper()
    if q in ("BEST", "WORST"):
        return q
    # Strip trailing P and re-add uppercase
    q = q.rstrip("P") + "P"
    return q


def _extract_quality_value(quality: str) -> int | None:
    digits = "".join(ch for ch in quality if ch.isdigit())
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _build_proxied_download_url(subject_id: str, season: int, episode: int) -> str:
    original = (
        f"{AONEROOM_DOWNLOAD_URL}?subjectId={subject_id}&se={season}&ep={episode}"
    )
    return f"{PROXY_DOWNLOAD_BASE}?url={quote(original, safe='')}"


async def _fetch_downloads(subject_id: str, season: int, episode: int) -> list[dict]:
    proxied_url = _build_proxied_download_url(subject_id, season, episode)
    headers = {
        "Accept": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(proxied_url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        raise RuntimeError(f"Failed to fetch download links via proxy: {exc}") from exc

    downloads = payload.get("data", {}).get("downloads", [])
    if not isinstance(downloads, list) or not downloads:
        raise RuntimeError("No downloadable links returned by proxy endpoint")

    normalized: list[dict] = []
    for item in downloads:
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        resolution = item.get("resolution", 0)
        if not isinstance(url, str) or not url:
            continue
        try:
            resolution_num = int(resolution or 0)
        except (TypeError, ValueError):
            resolution_num = 0
        normalized.append({"url": url, "resolution": resolution_num})

    if not normalized:
        raise RuntimeError("Proxy response did not include valid download links")

    return normalized


def _select_download(downloads: list[dict], quality: str) -> dict:
    normalized_quality = _normalize_quality(quality)
    sorted_downloads = sorted(
        downloads,
        key=lambda item: int(item.get("resolution", 0) or 0),
        reverse=True,
    )

    if normalized_quality == "BEST":
        return sorted_downloads[0]

    requested = _extract_quality_value(normalized_quality)
    if requested is None:
        return sorted_downloads[0]

    for item in sorted_downloads:
        if int(item.get("resolution", 0) or 0) == requested:
            return item

    return sorted_downloads[0]


async def get_movie(title: str, quality: str = "1080p") -> dict:
    """
    Search for a movie and return its CDN URL + metadata without downloading.

    Returns:
        {cdn_url: str, title: str, year: int, quality: str}

    Raises:
        RuntimeError on search or resolution failure.
    """
    session = Session()

    try:
        # Step 1: Search
        search = Search(session, query=title, subject_type=SubjectType.MOVIES, per_page=10)
        search_results = await search.get_content_model()

        if not search_results.items:
            raise RuntimeError(f"No results found for '{title}'")

        target = search_results.first_item

        # Step 2: Resolve downloads through our proxy, never direct aoneroom.
        downloads = await _fetch_downloads(str(target.subjectId), season=0, episode=0)
        selected = _select_download(downloads, quality)
        cdn_url = str(selected["url"])
        resolution = int(selected.get("resolution", 0) or 0)

        if not cdn_url:
            raise RuntimeError("Could not resolve a playable URL for selected movie")

        return {
            "cdn_url": cdn_url,
            "title": target.title,
            "year": target.releaseDate.year,
            "quality": f"{resolution}p" if resolution > 0 else quality,
            "subject_id": target.subjectId,
        }

    except Exception as exc:
        logger.error("Failed to get movie '%s': %s", title, exc)
        raise RuntimeError(f"Could not fetch movie '{title}': {exc}") from exc


async def get_episode(
    title: str, season: int, episode: int, quality: str = "1080p"
) -> dict:
    """
    Search for a TV series episode and return its CDN URL + metadata without downloading.

    Returns:
        {cdn_url: str, title: str, season: int, episode: int, quality: str}

    Raises:
        RuntimeError on search or resolution failure.
    """
    session = Session()

    try:
        # Step 1: Search for TV series
        search = Search(session, query=title, subject_type=SubjectType.TV_SERIES, per_page=10)
        search_results = await search.get_content_model()

        if not search_results.items:
            raise RuntimeError(f"No series results found for '{title}'")

        target = search_results.first_item

        # Step 2: Resolve downloads through our proxy, never direct aoneroom.
        downloads = await _fetch_downloads(
            str(target.subjectId), season=season, episode=episode
        )
        selected = _select_download(downloads, quality)
        cdn_url = str(selected["url"])
        resolution = int(selected.get("resolution", 0) or 0)

        if not cdn_url:
            raise RuntimeError("Could not resolve a playable URL for selected episode")

        return {
            "cdn_url": cdn_url,
            "title": target.title,
            "season": season,
            "episode": episode,
            "quality": f"{resolution}p" if resolution > 0 else quality,
            "subject_id": target.subjectId,
        }

    except Exception as exc:
        logger.error(
            "Failed to get episode '%s' S%dE%d: %s", title, season, episode, exc
        )
        raise RuntimeError(
            f"Could not fetch '{title}' S{season}E{episode}: {exc}"
        ) from exc
