"""
Configuration — all environment variables loaded in one place.
Import as: from config import settings
"""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    TELEGRAM_BOT_TOKEN: str
    REDIS_URL: str
    GROQ_API_KEY: str
    LINK_BASE_URL: str
    WEB_PROXY_BASE_URL: str
    CDN_TTL_HOURS: int
    MOVIEBOX_API_HOST_V2: str
    MOVIEBOX_DOWNLOAD_API_HOST: str
    OPENSUBTITLES_API_KEY: str | None = None
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    @classmethod
    def from_env(cls) -> "Settings":
        token = os.getenv("TELEGRAM_BOT_TOKEN")
        if not token:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is required")

        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
            upstash_host = os.getenv("UPSTASH_REDIS_REST_URL", "").replace("https://", "").replace("http://", "")
            if upstash_token and upstash_host:
                redis_url = f"rediss://default:{upstash_token}@{upstash_host}:6379"
            else:
                raise RuntimeError("REDIS_URL is required")

        groq_key = os.getenv("GROQ_API_KEY")
        if not groq_key:
            raise RuntimeError("GROQ_API_KEY is required")

        return cls(
            TELEGRAM_BOT_TOKEN=token,
            REDIS_URL=redis_url,
            GROQ_API_KEY=groq_key,
            LINK_BASE_URL=os.getenv("LINK_BASE_URL", "https://movies.samkiel.dev"),
            WEB_PROXY_BASE_URL=os.getenv("WEB_PROXY_BASE_URL", "https://samkiel.online"),
            CDN_TTL_HOURS=int(os.getenv("CDN_TTL_HOURS", "6")),
            MOVIEBOX_API_HOST_V2=os.getenv("MOVIEBOX_API_HOST_V2", "h5-api.aoneroom.com"),
            MOVIEBOX_DOWNLOAD_API_HOST=os.getenv("MOVIEBOX_DOWNLOAD_API_HOST", "h5.aoneroom.com"),
            OPENSUBTITLES_API_KEY=os.getenv("OPENSUBTITLES_API_KEY"),
            GROQ_MODEL=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        )


settings = Settings.from_env()
