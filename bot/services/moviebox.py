"""
moviebox.py — CDN URL extraction from moviebox-api without downloading.

=== moviebox-api internals investigation (Simatwa/moviebox-api on GitHub) ===

CDN URL resolution chain discovered by reading the source at
https://github.com/Simatwa/moviebox-api/tree/main/src/moviebox_api/v1

The library resolves CDN URLs in this order:

1. Search(session, query, subject_type).get_content_model()
   -> Returns SearchResultsModel containing SearchResultsItem objects.
   -> Each item has subjectId, title, releaseDate, etc.

2. DownloadableMovieFilesDetail(session, item).get_content_model()
   -> Hits endpoint: /wefeed-h5-bff/web/subject/download
   -> Params: {subjectId, se=0, ep=0} for movies, {subjectId, se=N, ep=N} for series
   -> Requires Referer header: get_absolute_url(f"/movies/{item.detailPath}")
   -> Returns DownloadableFilesMetadata (pydantic model) with:
      - downloads: list[MediaFileMetadata]  <-- CDN URLs live here
      - captions: list[CaptionFileMetadata]

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

APPROACH: Direct CDN URL interception. We use the library's Search,
DownloadableMovieFilesDetail, DownloadableTVSeriesFilesDetail, and
resolve_media_file_to_be_downloaded to get the CDN URL without ever
invoking the downloader. No temp files needed.

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

PROXY_BASE_URL = "https://samkiel.online/api/proxy"
DOWNLOAD_ENDPOINT = f"https://{settings.MOVIEBOX_API_HOST_V2}/wefeed-h5-bff/web/subject/download"


def _normalize_quality(quality: str) -> str:
    """Convert quality string to moviebox-api format (e.g. '1080p' -> '1080P')."""
    q = quality.strip().upper()
    if q in ("BEST", "WORST"):
        return q
    # Strip trailing P and re-add uppercase
    q = q.rstrip("P") + "P"
    return q


def _build_download_url(subject_id: str, season: int, episode: int) -> str:
    return f"{DOWNLOAD_ENDPOINT}?subjectId={subject_id}&se={season}&ep={episode}"


def _build_proxy_url(download_url: str) -> str:
    return f"{PROXY_BASE_URL}?url={quote(download_url, safe='')}"


def _select_download(downloads: list[dict], quality: str) -> dict:
    norm_quality = _normalize_quality(quality)
    # Keep BEST semantics as default/fallback when an exact resolution is unavailable.
    if norm_quality == "BEST":
        return max(downloads, key=lambda d: int(d.get("resolution") or 0))

    if norm_quality == "WORST":
        return min(downloads, key=lambda d: int(d.get("resolution") or 0))

    target_resolution = int(norm_quality.rstrip("P"))
    for item in downloads:
        if int(item.get("resolution") or 0) == target_resolution:
            return item

    return max(downloads, key=lambda d: int(d.get("resolution") or 0))


async def _fetch_downloads_via_proxy(subject_id: str, season: int, episode: int) -> list[dict]:
    download_url = _build_download_url(subject_id, season, episode)
    proxy_url = _build_proxy_url(download_url)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(proxy_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Proxy fetch failed for subject {subject_id}: {exc}") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError("Proxy response was not valid JSON for subject/download") from exc

    downloads = payload.get("data", {}).get("downloads", []) if isinstance(payload, dict) else []
    if not isinstance(downloads, list) or not downloads:
        raise RuntimeError("No downloads found in proxied subject/download response")

    return downloads


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

        # Step 2: Fetch downloadable metadata through the web proxy.
        downloads = await _fetch_downloads_via_proxy(target.subjectId, season=0, episode=0)

        # Step 3: Resolve quality from the proxied downloads list.
        selected = _select_download(downloads, quality)
        cdn_url = str(selected.get("url") or "")
        if not cdn_url:
            raise RuntimeError("Selected download entry is missing URL")

        resolution = int(selected.get("resolution") or 0)

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

        # Step 2: Fetch episode downloads through the web proxy.
        downloads = await _fetch_downloads_via_proxy(target.subjectId, season=season, episode=episode)

        # Step 3: Resolve quality from the proxied downloads list.
        selected = _select_download(downloads, quality)
        cdn_url = str(selected.get("url") or "")
        if not cdn_url:
            raise RuntimeError("Selected episode download entry is missing URL")

        resolution = int(selected.get("resolution") or 0)

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
