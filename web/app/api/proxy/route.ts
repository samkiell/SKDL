import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * Legacy proxy route: zero-proxy 302 redirect.
 * Video bytes and third-party APIs are NEVER fetched or proxied through Cloudflare.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  
  if (!url || url === 'undefined' || url === 'null') {
    return new NextResponse('Gone or Missing URL', { status: 410 })
  }

  try {
    return NextResponse.redirect(url, 302)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`Redirect failed: ${message}`, { status: 500 })
  }
}
