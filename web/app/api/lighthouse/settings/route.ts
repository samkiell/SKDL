import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const redis = getRedisClient()
    const settings = (await redis.hgetall('settings')) || {}
    const heartbeat = await redis.get('bot:heartbeat')
    if (heartbeat) {
      settings.bot_heartbeat = heartbeat
    }
    return NextResponse.json(settings)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    const redis = getRedisClient()
    await redis.hset('settings', { [key]: value })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
