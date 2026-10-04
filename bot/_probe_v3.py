"""Decide the fix: (A) does the OLD unsigned web endpoint still work?
   (B) does v3 signed search work from this machine?"""
import asyncio
import httpx
from moviebox_api.v3.http_client import MovieBoxHttpClient
from moviebox_api.v3.core import Search as V3Search
from moviebox_api.v1.constants import SubjectType

UA = "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0"


async def test_old_web_endpoint():
    """OLD v1 web endpoint used by moviebox-api 0.4.0.post1 (unsigned)."""
    url = "https://h5.aoneroom.com/wefeed-h5-bff/web/subject/search"
    headers = {
        "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.5",
        "User-Agent": UA,
        "Referer": "https://h5.aoneroom.com/",
        "Host": "h5.aoneroom.com",
    }
    payload = {"keyword": "Dexter", "page": 1, "perPage": 10, "subjectType": 2}
    try:
        async with httpx.AsyncClient(timeout=20, headers=headers) as c:
            r = await c.post(url, json=payload)
            print(f"[A] OLD web endpoint -> {r.status_code}  body={r.text[:160]!r}")
    except Exception as e:
        print(f"[A] OLD web endpoint EXC {type(e).__name__}: {e}")


async def test_v3_signed():
    """v3 signed search via the library."""
    try:
        async with MovieBoxHttpClient() as client:
            search = V3Search(client, query="Dexter", subject_type=SubjectType.TV_SERIES, per_page=10)
            model = await search.get_content_model()
            items = getattr(model, "items", None) or []
            print(f"[B] v3 signed search -> OK, {len(items)} items")
            for it in items[:3]:
                sid = getattr(it, "subject_id", getattr(it, "subjectId", "?"))
                title = getattr(it, "title", "?")
                print(f"      - {title}  subjectId={sid}")
            return items
    except Exception as e:
        import traceback
        print(f"[B] v3 signed search EXC {type(e).__name__}: {e}")
        traceback.print_exc()
        return []


async def main():
    await test_old_web_endpoint()
    print()
    await test_v3_signed()


asyncio.run(main())
