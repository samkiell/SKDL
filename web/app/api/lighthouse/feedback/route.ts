import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function parseFeedbackItem(item: any): any {
  if (!item) return null
  try {
    let parsed = typeof item === 'string' ? JSON.parse(item) : item
    if (typeof parsed === 'string') parsed = JSON.parse(parsed)
    if (Array.isArray(parsed) && parsed[0]) {
      parsed = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0]
    }
    if (parsed && typeof parsed === 'object' && parsed.message) {
      return {
        id: String(parsed.id || ''),
        type: String(parsed.type || 'general'),
        message: String(parsed.message || ''),
        name: parsed.name ? String(parsed.name) : null,
        created_at: parsed.created_at || new Date().toISOString(),
      }
    }
  } catch {
    // Ignore parse error
  }
  return null
}

export async function GET() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('lighthouse_auth')?.value
  if (auth !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const redis = getRedisClient()
    const raw = await redis.lrange('feedback', 0, 100)
    const submissions = (raw || []).map(parseFeedbackItem).filter(Boolean)
    return NextResponse.json({ submissions })
  } catch (error) {
    console.error('API Error /api/lighthouse/feedback (GET):', error)
    return NextResponse.json({ submissions: [] }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const auth = cookieStore.get('lighthouse_auth')?.value
  if (auth !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
  }

  try {
    const redis = getRedisClient()
    const raw = await redis.lrange<any>('feedback', 0, 100)
    for (const item of (raw || [])) {
      const parsed = parseFeedbackItem(item)
      if (parsed && parsed.id === id) {
        await redis.lrem('feedback', 0, item)
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error /api/lighthouse/feedback (DELETE):', error)
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 })
  }
}
