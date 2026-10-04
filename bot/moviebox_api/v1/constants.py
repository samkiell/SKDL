"""This module stores constant variables"""

import os
import typing as t
from enum import IntEnum, StrEnum
from pathlib import Path

from throttlebuster.constants import (
    DEFAULT_CHUNK_SIZE,
    DEFAULT_READ_TIMEOUT_ATTEMPTS,
    DEFAULT_TASKS_LIMIT,
    DOWNLOAD_PART_EXTENSION,
    DownloadMode,
)

from moviebox_api.v1 import logger

"""asyncio event loop"""

MIRROR_HOSTS = (
    "h5.aoneroom.com",
    # Sess https://github.com/Simatwa/moviebox-api/issues/63
    # "movieboxapp.in",
    # "moviebox.pk",
    # "moviebox.ph",
    # "moviebox.id",
    # "fmoviesunblocked.net"
    # "v.moviebox.ph",
    # "netnaija.video",
    # "sflix.film",
    # "netnaija.com"
)
"""Mirror domains/subdomains of Moviebox"""

ENVIRONMENT_HOST_KEY = "MOVIEBOX_API_HOST"
"""User declares host to use as environment variable using this key"""

SELECTED_HOST = (
    os.getenv(ENVIRONMENT_HOST_KEY) or MIRROR_HOSTS[0]
)  # TODO: Choose the right value based on working status
"""Host adress only with protocol"""

HOST_PROTOCOL = "https"
"""Host protocol i.e http/https"""

HOST_URL = f"{HOST_PROTOCOL}://{SELECTED_HOST}/"
"""Complete host adress with protocol"""

logger.info(f"Moviebox host url - {HOST_URL}")

DEFAULT_REQUEST_HEADERS = {
    "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Referer": "https://videodownloader.site/",
    "Origin": "https://videodownloader.site",
    "Host": SELECTED_HOST,
}
"""For general http requests other than download"""

DOWNLOAD_REQUEST_REFERER = "https://videodownloader.site/"

DOWNLOAD_REQUEST_HEADERS = {
    "Accept": "*/*",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Origin": "https://videodownloader.site",
    "Referer": DOWNLOAD_REQUEST_REFERER,
}
"""For media and subtitle files download requests"""


type DownloadQualitiesType = t.Literal[
    "WORST", "BEST", "360P", "480P", "720P", "1080P"
]  # TODO: Add more qualities

DOWNLOAD_QUALITIES = (
    "WORST",
    "BEST",
    "360P",
    "480P",
    "720P",
    "1080P",
)  # TODO: Add more qualities


DEFAULT_CAPTION_LANGUAGE = "English"

DEFAULT_CAPTION_LANGUAGE_SHORT = "en"

CURRENT_WORKING_DIR = Path(os.getcwd())
"""Directory where contents will be saved to by default"""

ITEM_DETAILS_PATH = "/detail"
"""Immediate path to particular item details page"""


DEFAULT_TASKS = 5
"""Default number of connections for download"""


class SubjectType(IntEnum):
    """Content types mapped to their integer representatives"""

    ALL = 0
    """Both Movies, series and music contents"""

    MOVIES = 1
    """Movies content only"""

    TV_SERIES = 2
    """TV Series content only"""

    EDUCATION = 5
    """Anime contents only"""

    MUSIC = 6  # AUDIO
    """Music contents only"""

    ANIME = 7  # "ShortTV"
    """Anime contents only"""

    OTHER = 8
    """Other contents"""

    UNKNOWN = 9

    # TODO: Research and update UNKNOWNS

    @classmethod
    def map(cls, ignore_names: set[str] = []) -> dict[str, int]:
        """Content-type names mapped to their int representatives"""
        resp = {}
        for entry in cls:
            if entry.name in ignore_names:
                continue

            resp[entry.name] = entry.value
        return resp


class DownloadStatus(StrEnum):
    DOWNLOADING = "downloading"
    FINISHED = "finished"
