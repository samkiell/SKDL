import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ found: false }, { status: 400 })
  }

  try {
    const redis = getRedisClient()

    // 1. Check active media record
    const active = await redis.get<any>(`media:${id}`)
    if (active?.title) {
      return NextResponse.json({
        found: true,
        title: active.title,
        type: active.type || 'movie',
        season: active.season || null,
        episode: active.episode || null,
        expired: false,
      })
    }

    // 2. Check long-lived metadata record
    const meta = await redis.get<any>(`media:meta:${id}`)
    if (meta?.title) {
      return NextResponse.json({
        found: true,
        title: meta.title,
        type: meta.type || 'movie',
        season: meta.season || null,
        episode: meta.episode || null,
        expired: true,
      })
    }

    // 3. Search recent list
    const recent = await redis.lrange('media:recent', 0, 100)
    for (const item of recent) {
      try {
        const parsed = typeof item === 'string' ? JSON.parse(item) : item
        if (parsed?.id === id && parsed?.title) {
          return NextResponse.json({
            found: true,
            title: parsed.title,
            type: parsed.type || 'movie',
            season: parsed.season || null,
            episode: parsed.episode || null,
            expired: true,
          })
        }
      } catch {}
    }

    return NextResponse.json({ found: false })
  } catch (error) {
    console.error('Media lookup error:', error)
    return NextResponse.json({ found: false })
  }
}
