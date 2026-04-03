import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/admin-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stats = await getDashboardStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('API Error /api/lighthouse/stats:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
