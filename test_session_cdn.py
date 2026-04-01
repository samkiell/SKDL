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

async def test_session_cdn():
    session = Session()
    os.environ["MOVIEBOX_API_HOST_V2"] = settings.MOVIEBOX_API_HOST_V2
    
    print("Searching for movie...")
    search = Search(session, query="Oppenheimer", subject_type=SubjectType.MOVIES, per_page=1)
    search_results = await search.get_content_model()
    target = search_results.first_item
    
    print(f"Getting download detail for: {target.title}")
    detail = DownloadableMovieFilesDetail(session, target)
    downloadable = await detail.get_content_model()
    media_file = resolve_media_file_to_be_downloaded("1080P", downloadable)
    url = str(media_file.url)
    print(f"Fresh URL: {url}")
    
    # Use the session's internal aiohttp.ClientSession if available, 
    # but Session() in moviebox_api is usually just a container.
    # Let's check session cookies.
    cookies = session.cookies
    print(f"Cookies gathered: {cookies}")
    
    headers = {
        "Referer": f"https://h5.aoneroom.com/movies/{target.detailPath}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with aiohttp.ClientSession(cookies=cookies) as client:
        print(f"\nTest: WITH session cookies and specific Referer: {headers['Referer']}...")
        async with client.get(url, headers=headers) as resp:
            print(f"Status: {resp.status}")
            if resp.status == 200:
                print("✅ SUCCESS! Cookie + Referer fix works.")
            else:
                text = await resp.text()
                print(f"❌ FAILED Status {resp.status}: {text[:200]}")

if __name__ == "__main__":
    from moviebox_api.v1 import DownloadableMovieFilesDetail
    sys.path.append(os.path.join(os.getcwd(), "bot"))
    asyncio.run(test_session_cdn())
