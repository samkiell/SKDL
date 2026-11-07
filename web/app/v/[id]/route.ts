import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { getMovieBoxDetails } from '@/lib/moviebox'

export const dynamic = 'force-dynamic'

interface MediaRow {
  id: string
  title: string
  cdn_url: string
  type: 'movie' | 'series'
  quality: string
  season: number | null
  episode: number | null
  expires_at: string
  subject_id?: string
}

/**
 * Short video link route handler (/v/[id]).
 * Issues an HTTP 302 redirect directly to the raw CDN URL resolved by the bot.
 * Cloudflare Workers / Pages Functions will never fetch, stream, or proxy video bytes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const redis = getRedisClient()
    const data = await redis.get<MediaRow>(`media:${id}`)

    if (!data) {
      return new NextResponse('Media not found', { status: 404 })
    }

    const row = data as MediaRow
    const expiresAt = new Date(row.expires_at)
    if (expiresAt < new Date()) {
      return new NextResponse('Link expired', { status: 410 })
    }

    let targetUrl = row.cdn_url

    if (!targetUrl && row.subject_id) {
      try {
        const details = await getMovieBoxDetails(
          row.subject_id,
          row.type,
          row.season || 0,
          row.episode || 0
        )
        const downloads = details.downloads || []
        if (downloads.length > 0) {
          const requestedRes = parseInt((row.quality || '').replace(/\D/g, ''), 10) || 0
          const matched = requestedRes > 0
            ? downloads.find(d => Number(d.resolution) === requestedRes)
            : null
          targetUrl = matched?.url || downloads[0]?.url || ''
        }
      } catch (e) {
        console.error('Failed to resolve fallback CDN URL in /v/[id]:', e)
      }
    }

    if (!targetUrl) {
      return new NextResponse('Video URL unavailable', { status: 404 })
    }

    // 302 Redirect directly to the raw CDN URL
    return NextResponse.redirect(targetUrl, 302)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new NextResponse(`Redirect failed: ${message}`, { status: 500 })
  }
}
