import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export async function POST(req: Request) {
  try {
    const { type, message, name } = await req.json()

    // Validation
    if (!type || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['bug', 'suggestion', 'general'].includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message too long (max 1000 chars)' }, { status: 400 })
    }

    // Insert into Redis
    const redis = getRedisClient()
    await redis.lpush('feedback', JSON.stringify({
      id: crypto.randomUUID(),
      type,
      message,
      name: name?.trim() || null,
      created_at: new Date().toISOString(),
    }))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('API Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
