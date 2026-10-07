import { NextResponse } from 'next/server'
import { trackDownload } from '@/lib/analytics'

export async function POST(req: Request) {
  try {
    const { title, media_type, format } = await req.json()
    await trackDownload({ title, media_type, format })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Track download exception:', err)
    return NextResponse.json({ ok: true }) // Silent fail
  }
}
