"""
opensubtitles.py — Search and download subtitles from OpenSubtitles.com.
"""

import logging
import httpx
from config import settings

logger = logging.getLogger(__name__)

async def search_subtitles(imdb_id: str | None = None, query: str | None = None, lang: str = "en") -> list[dict]:
    """
    Search for subtitles on OpenSubtitles.com.
    Returns a list of subtitle attributes.
    """
    if not settings.OPENSUBTITLES_API_KEY:
        logger.warning("OPENSUBTITLES_API_KEY not configured")
        return []

    try:
        params = {"languages": lang}
        if imdb_id:
            # Strip 'tt' prefix if it exists
            params["imdb_id"] = imdb_id.replace("tt", "")
        elif query:
            params["query"] = query
        else:
            return []

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.opensubtitles.com/api/v1/subtitles",
                params=params,
                headers={
                    "Api-Key": settings.OPENSUBTITLES_API_KEY,
                    "User-Agent": "SKDL v1.0",
                    "Accept": "application/json",
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                logger.error("OpenSubtitles search failed with status %d: %s", response.status_code, response.text)
                return []

            data = response.json()
            return data.get("data", [])

    except Exception as exc:
        logger.error("OpenSubtitles search exception: %s", exc)
        return []

async def download_subtitle(file_id: int) -> dict | None:
    """
    Get the download link for a specific subtitle file.
    """
    if not settings.OPENSUBTITLES_API_KEY:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.opensubtitles.com/api/v1/download",
                headers={
                    "Api-Key": settings.OPENSUBTITLES_API_KEY,
                    "User-Agent": "SKDL v1.0",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={"file_id": file_id},
                timeout=10.0
            )

            if response.status_code != 200:
                logger.error("OpenSubtitles download failed with status %d: %s", response.status_code, response.text)
                return None

            return response.json()

    except Exception as exc:
        logger.error("OpenSubtitles download exception: %s", exc)
        return None

def find_best_match(subtitles: list[dict]) -> dict | None:
    """
    Pick the best subtitle from a list based on release name keywords.
    """
    if not subtitles:
        return None

    keywords = ["WEB-DL", "WEBRip", "DVDRip", "Bluray", "BRRip", "1080p", "720p"]
    
    for sub in subtitles:
        release = (sub.get("attributes", {}).get("release") or "").upper()
        if any(k.upper() in release for k in keywords):
            return sub

    return subtitles[0]
