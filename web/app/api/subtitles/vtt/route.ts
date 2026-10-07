import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function srtToVtt(content: string): string {
  if (content.trim().startsWith('WEBVTT')) {
    return content
  }
  // Strip BOM if present
  let text = content.replace(/^\uFEFF/, '')
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  // Convert timestamp format from 00:00:00,000 to 00:00:00.000
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return `WEBVTT\n\n${text}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const subUrl = searchParams.get('url')

  if (!subUrl || subUrl === 'undefined' || subUrl === 'null') {
    return new NextResponse('Missing subtitle URL', { status: 400 })
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Referer': 'https://videodownloader.site/',
      'Origin': 'https://videodownloader.site',
      'Accept': '*/*',
    }

    const res = await fetch(subUrl, { headers, redirect: 'follow' })
    if (!res.ok) {
      return new NextResponse(`Failed to fetch subtitle from origin: ${res.status}`, { status: res.status })
    }

    const rawText = await res.text()
    if (!rawText || rawText.trim().length === 0) {
      return new NextResponse('Empty subtitle file', { status: 404 })
    }

    const vttContent = srtToVtt(rawText)

    return new NextResponse(vttContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err: any) {
    console.error('[subtitles/vtt] conversion error:', err)
    return new NextResponse(`Subtitle conversion failed: ${err.message || 'unknown error'}`, { status: 500 })
  }
}
