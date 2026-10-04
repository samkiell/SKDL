import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const auth = cookieStore.get('lighthouse_auth')
  if (!auth || auth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const search = (searchParams.get('search') || '').toLowerCase().trim()
  const limit = 25

  try {
    const redis = getRedisClient()
    const rawRecent = await redis.lrange<any>('media:recent', 0, 199)
    let links = (rawRecent || []).map(r => {
      const item = typeof r === 'string' ? JSON.parse(r) : { ...r }
      if (!item.requested_at) {
        item.requested_at = item.created_at || new Date().toISOString()
      }
      if (!item.expires_at) {
        item.expires_at = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
      }
      return item
    })

    if (search) {
      links = links.filter(l => 
        (l.id && String(l.id).toLowerCase().includes(search)) ||
        (l.title && String(l.title).toLowerCase().includes(search))
      )
    }

    const total = links.length
    const from = (page - 1) * limit
    const pagedLinks = links.slice(from, from + limit)

    return NextResponse.json({
      links: pagedLinks,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit))
    })
  } catch (error) {
    console.error('API Error /api/lighthouse/links:', error)
    return NextResponse.json({ links: [], total: 0, page: 1, totalPages: 1 }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const auth = cookieStore.get('lighthouse_auth')
  if (!auth || auth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
  }

  try {
    const redis = getRedisClient()
    await redis.del(`media:${id}`)
    const rawRecent = await redis.lrange<any>('media:recent', 0, 199)
    for (const item of (rawRecent || [])) {
      const parsed = typeof item === 'string' ? JSON.parse(item) : item
      if (parsed.id === id) {
        await redis.lrem('media:recent', 0, item)
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error /api/lighthouse/links (DELETE):', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
