import { NextResponse } from 'next/server'
import { trackPageview } from '@/lib/analytics'

export async function POST(req: Request) {
  try {
    const { path } = await req.json()
    await trackPageview(typeof path === 'string' ? path : '/')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Track pageview exception:', err)
    return NextResponse.json({ ok: true }) // Silent fail
  }
}
