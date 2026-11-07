import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  
  if (!url || url === 'undefined' || url === 'null') {
    return new NextResponse('Missing URL', { status: 400 })
  }

  try {
    const isDownloadApi = /\/subject\/download/.test(url)

    // Non-video JSON metadata API (not video bytes)
    if (isDownloadApi) {
      const headers = new Headers()
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
      headers.set('Accept', 'application/json, text/plain, */*')
      headers.set('Accept-Language', 'en-US,en;q=0.9')

      const response = await fetch(url, { 
        headers,
        method: 'GET',
        cache: 'no-store'
      })

      if (!response.ok) {
        return new NextResponse(`Download API error: ${response.status}`, { status: response.status })
      }

      return new NextResponse(response.body, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
    }

    /**
     * Video content must NEVER be proxied or streamed through Cloudflare.
     * All video proxy/streaming logic (fetching video bytes, streaming response.body,
     * spoofing Referer/Origin headers) has been disabled.
     * Return a 302 redirect directly to the raw URL.
     */
    return NextResponse.redirect(url, 302)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`Redirect failed: ${message}`, { status: 500 })
  }
}
