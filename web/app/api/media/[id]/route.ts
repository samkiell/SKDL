import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'

interface MediaRow {
  id: string
  title: string
  cdn_url: string
  type: 'movie' | 'series'
  quality: string
  season: number | null
  episode: number | null
  subject_id?: string
  imdb_id?: string | null
  size?: number | null
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

    return NextResponse.json({ 
      url: row.cdn_url || '',
      title: row.title,
      type: row.type,
      season: row.season,
      episode: row.episode,
      quality: row.quality || '1080p',
      imdb_id: row.imdb_id || null,
      size: row.size || null,
      subject_id: row.subject_id || null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
