import aiohttp
import asyncio
import logging

logging.basicConfig(level=logging.INFO)

async def test_cdn():
    # URL from the logs that failed
    url = "https://bcdnxw.hakunaymatata.com/resource/888215a60acf4eb0992bc40199293861.mp4?sign=26a5fb3a5815060167c4e01d146a41b3&t=1775005372"
    
    headers = {
        "Referer": "https://h5.aoneroom.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with aiohttp.ClientSession() as session:
        print(f"Testing URL with Referer: {headers['Referer']}...")
        async with session.get(url, headers=headers) as resp:
            print(f"Status: {resp.status}")
            if resp.status == 200:
                print("✅ SUCCESS! Referer fix works.")
            else:
                print(f"❌ FAILED. Status {resp.status}")
                text = await resp.text()
                print(f"Response: {text[:200]}")

if __name__ == "__main__":
    asyncio.run(test_cdn())
