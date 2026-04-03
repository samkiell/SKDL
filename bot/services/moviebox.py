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

from moviebox_api.v1 import (
    Search,
    Session,
    DownloadableMovieFilesDetail,
    DownloadableTVSeriesFilesDetail,
    resolve_media_file_to_be_downloaded,
)
from moviebox_api.v1.constants import SubjectType

from config import settings

logger = logging.getLogger(__name__)

# Override moviebox host if configured
import os
os.environ.setdefault("MOVIEBOX_API_HOST_V2", settings.MOVIEBOX_API_HOST_V2)


def _normalize_quality(quality: str) -> str:
    """Convert quality string to moviebox-api format (e.g. '1080p' -> '1080P')."""
    q = quality.strip().upper()
    if q in ("BEST", "WORST"):
        return q
    # Strip trailing P and re-add uppercase
    q = q.rstrip("P") + "P"
    return q


def _resolve_sdk_media_file(downloadable, quality: str):
    try:
        return resolve_media_file_to_be_downloaded(_normalize_quality(quality), downloadable)
    except Exception:
        # Requested quality may be unavailable; fall back to best available.
        best = getattr(downloadable, "best_media_file", None)
        if best is not None:
            return best
        downloads = getattr(downloadable, "downloads", None) or []
        if downloads:
            return max(downloads, key=lambda d: int(getattr(d, "resolution", 0) or 0))
        raise


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

        # Step 2: Resolve download metadata via SDK only.
        detail = DownloadableMovieFilesDetail(session, target)
        downloadable = await detail.get_content_model()
        media_file = _resolve_sdk_media_file(downloadable, quality)
        cdn_url = str(media_file.url)
        resolution = int(media_file.resolution or 0)

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


async def get_available_qualities(title: str, is_series: bool, season: int | None = None, episode: int | None = None) -> dict:
    session = Session()
    try:
        if is_series:
            search = Search(session, query=title, subject_type=SubjectType.TV_SERIES, per_page=1)
            results = await search.get_content_model()
            if not results.items: return {}
            target = results.first_item
            detail = DownloadableTVSeriesFilesDetail(session, target)
            downloadable = await detail.get_content_model(season=season, episode=episode)
        else:
            search = Search(session, query=title, subject_type=SubjectType.MOVIES, per_page=1)
            results = await search.get_content_model()
            if not results.items: return {}
            target = results.first_item
            detail = DownloadableMovieFilesDetail(session, target)
            downloadable = await detail.get_content_model()
            
        downloads = getattr(downloadable, "downloads", []) or []
        qualities = []
        for d in downloads:
            res = int(getattr(d, "resolution", 0) or 0)
            size = int(getattr(d, "size", 0) or 0)
            if res > 0:
                qualities.append({"resolution": res, "size": size, "label": f"{res}p"})
        
        # Sort best to worst
        qualities.sort(key=lambda x: x["resolution"], reverse=True)
        return {"title": target.title, "qualities": qualities}
    except Exception as exc:
        logger.error("Failed to fetch available qualities: %s", exc)
        return {}


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

        # Step 2: Resolve episode download metadata via SDK only.
        detail = DownloadableTVSeriesFilesDetail(session, target)
        downloadable = await detail.get_content_model(season=season, episode=episode)
        media_file = _resolve_sdk_media_file(downloadable, quality)
        cdn_url = str(media_file.url)
        resolution = int(media_file.resolution or 0)

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
