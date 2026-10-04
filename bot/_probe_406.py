"""Throwaway probe: reproduce the moviebox search 406 and test fixes."""
import asyncio
import httpx

HOST = "h5-api.aoneroom.com"
BASE = f"https://{HOST}/wefeed-h5api-bff"

# Headers the v2 library actually sends (DOWNLOAD_REQUEST_HEADERS)
LIB_HEADERS = {
    "Accept": "*/*",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
    "Origin": "https://videodownloader.site/",
    "Referer": "https://videodownloader.site/",
}

# A "browser-like" set, json accept + matching origin/referer
BROWSER_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Origin": "https://videodownloader.site",
    "Referer": "https://videodownloader.site/",
    "X-Client-Info": '{"timezone":"Africa/Nairobi"}',
}

SEARCH_PAYLOAD = {"keyword": "Dexter", "page": 1, "perPage": 10, "subjectType": 2}
SUGGEST_PAYLOAD = {"per_page": 10, "keyword": "Dexter"}


async def probe(label, url, payload, headers):
    try:
        async with httpx.AsyncClient(timeout=20, headers=headers) as c:
            r = await c.post(url, json=payload)
            body = r.text[:200].replace("\n", " ")
            print(f"[{label}] {r.status_code}  body={body}")
    except Exception as e:
        print(f"[{label}] EXC {type(e).__name__}: {e}")


async def main():
    print("=== search-suggest (expected 200) ===")
    await probe("suggest/lib", f"{BASE}/subject/search-suggest", SUGGEST_PAYLOAD, LIB_HEADERS)

    print("\n=== search with LIBRARY headers (this is what fails on Render) ===")
    await probe("search/lib", f"{BASE}/subject/search", SEARCH_PAYLOAD, LIB_HEADERS)

    print("\n=== search with BROWSER headers (json accept + content-type) ===")
    await probe("search/browser", f"{BASE}/subject/search", SEARCH_PAYLOAD, BROWSER_HEADERS)

    print("\n=== search with browser headers minus Accept-Encoding tricks, add gzip ===")
    h = dict(BROWSER_HEADERS)
    h["Accept-Encoding"] = "gzip, deflate, br"
    await probe("search/browser+enc", f"{BASE}/subject/search", SEARCH_PAYLOAD, h)


asyncio.run(main())
