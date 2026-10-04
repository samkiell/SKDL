import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  const filename = searchParams.get('filename')
  const isDownloadFile = searchParams.get('dl') === '1'
  
  if (!url || url === 'undefined' || url === 'null') {
    return new NextResponse('Missing URL', { status: 400 })
  }

  try {
    const isDownloadApi = /\/subject\/download/.test(url)
    const headers = new Headers()

    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
    headers.set('Accept', isDownloadApi ? 'application/json, text/plain, */*' : '*/*')
    headers.set('Accept-Language', 'en-US,en;q=0.9')
    headers.set('Connection', 'keep-alive')
    headers.set('Referer', 'https://videodownloader.site/')
    headers.set('Origin', 'https://videodownloader.site')

    if (!isDownloadApi) {
      headers.set('Sec-Fetch-Dest', 'video')
      headers.set('Sec-Fetch-Mode', 'no-cors')
      headers.set('Sec-Fetch-Site', 'cross-site')
      
      const clientRange = request.headers.get('range')
      if (clientRange) {
        headers.set('Range', clientRange)
      }
    }

    const response = await fetch(url, { 
      headers,
      method: 'GET',
      cache: 'no-store'
    })

    if (!response.ok) {
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
    
    let contentDisposition = 'inline'
    if (filename) {
      contentDisposition = `${isDownloadFile ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`
    }

    const resHeaders = new Headers()
    resHeaders.set('Content-Type', response.headers.get('content-type') || 'video/mp4')
    resHeaders.set('Content-Disposition', contentDisposition)
    resHeaders.set('Cache-Control', 'no-cache')
    resHeaders.set('Accept-Ranges', 'bytes')

    const contentRange = response.headers.get('content-range')
    if (contentRange) {
      resHeaders.set('Content-Range', contentRange)
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      resHeaders.set('Content-Length', contentLength)
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`Proxy failed: ${message}`, { status: 500 })
  }
}
