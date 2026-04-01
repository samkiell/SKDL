import aiohttp
import asyncio
import logging
import sys
import os

# Mock settings
class MockSettings:
    MOVIEBOX_API_HOST_V2 = "h5.aoneroom.com"

settings = MockSettings()

# From bot/services/moviebox.py
from moviebox_api.v1 import Search, Session, DownloadableTVSeriesFilesDetail, resolve_media_file_to_be_downloaded
from moviebox_api.v1.constants import SubjectType

async def get_fresh_url():
    session = Session()
    os.environ["MOVIEBOX_API_HOST_V2"] = settings.MOVIEBOX_API_HOST_V2
    
    search = Search(session, query="Breaking Bad", subject_type=SubjectType.TV_SERIES, per_page=1)
    search_results = await search.get_content_model()
    target = search_results.first_item
    
    detail = DownloadableTVSeriesFilesDetail(session, target)
    downloadable = await detail.get_content_model(season=3, episode=12)
    media_file = resolve_media_file_to_be_downloaded("1080P", downloadable)
    return str(media_file.url)

async def test_fresh_cdn():
    url = await get_fresh_url()
    print(f"Fresh URL: {url}")
    
    headers_no_referer = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    headers_with_referer = {
        "Referer": "https://h5.aoneroom.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with aiohttp.ClientSession() as session:
        print("\nTest 1: WITHOUT Referer...")
        async with session.get(url, headers=headers_no_referer) as resp:
            print(f"Status: {resp.status}")
            
        print("\nTest 2: WITH Referer (h5.aoneroom.com)...")
        async with session.get(url, headers=headers_with_referer) as resp:
            print(f"Status: {resp.status}")
            if resp.status == 200:
                print("✅ SUCCESS! Referer fix works.")
            else:
                text = await resp.text()
                print(f"FAILED Status {resp.status}: {text[:200]}")

if __name__ == "__main__":
    # Ensure sys.path includes the project path for moviebox_api imports
    sys.path.append(os.path.join(os.getcwd(), "bot"))
    asyncio.run(test_fresh_cdn())
