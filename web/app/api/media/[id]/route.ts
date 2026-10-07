import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'
import { getFreshCdnUrl } from '@/lib/moviebox'

interface MediaRow {
  id: string
  title: string
  cdn_url: string
  type: 'movie' | 'series'
  quality: string
  season: number | null
  episode: number | null
  subject_id?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = (await params) as { id: string }
  
  try {
    const redis = getRedisClient()
    const data = await redis.get<MediaRow>(`media:${id}`)

    if (!data) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 })
    }

    const row = data as MediaRow
    let finalUrl = row.cdn_url

    if (row.subject_id) {
      try {
        finalUrl = await getFreshCdnUrl(
          row.subject_id,
          row.type,
          row.season || 0,
          row.episode || 0
        )
      } catch (e) {
        console.error('Failed to refresh CDN URL for download page:', e)
        // fallback to row.cdn_url
      }
    }

    const resolvedUrl = (finalUrl && finalUrl !== 'undefined' && finalUrl !== 'null') ? finalUrl : row.cdn_url

    return NextResponse.json({ 
      url: resolvedUrl || '',
      title: row.title,
      type: row.type,
      season: row.season,
      episode: row.episode,
      quality: row.quality || '1080p',
      imdb_id: (row as any).imdb_id || null,
      size: (row as any).size || null,
      subject_id: row.subject_id || null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
