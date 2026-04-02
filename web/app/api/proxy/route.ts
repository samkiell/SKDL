import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')

  if (!url) {
    return new NextResponse('Missing URL', { status: 400 })
  }

  try {
    const isDownloadApi = /\/wefeed-h5-bff\/web\/subject\/download/.test(url)
    const headers = new Headers()

    // Restored from previously working proxy implementation (commit 19f41c4).
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    headers.set('Referer', 'https://fmoviesunblocked.net/')
    headers.set('Origin', 'https://h5.aoneroom.com')
    headers.set('Accept', '*/*')
    headers.set('Accept-Language', 'en-US,en;q=0.9')
    headers.set('Connection', 'keep-alive')
    headers.set('Sec-Fetch-Dest', 'video')
    headers.set('Sec-Fetch-Mode', 'no-cors')
    headers.set('Sec-Fetch-Site', 'cross-site')
    headers.set('Accept-Encoding', 'identity')
    headers.set('Range', 'bytes=0-')

    console.info('[proxy] outgoing', {
      target: url,
      isDownloadApi,
      headers: Object.fromEntries(headers.entries()),
    })

    const response = await fetch(url, { 
      headers,
      method: 'GET',
      cache: 'no-store'
    })

    console.info('[proxy] response', {
      target: url,
      status: response.status,
      statusText: response.statusText,
    })

    if (!response.ok) {
        // Log detailed error from CDN if possible for debugging
        const text = await response.text()
        console.error(`[proxy] error body: ${text.slice(0, 500)}`)
        return new NextResponse(`Proxy error: ${response.status} ${response.statusText}`, { status: response.status })
    }

    if (isDownloadApi) {
      return new NextResponse(response.body, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
        'Content-Disposition': 'inline', 
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes', // Enable seeking if the source supports it
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`Proxy failed: ${message}`, { status: 500 })
  }
}
