import { NextResponse } from 'next/server'
import { getDashboardStats, getBotAnalytics } from '@/lib/admin-data'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const auth = cookieStore.get('lighthouse_auth')
  
  if (!auth || auth.value !== 'true') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    
    const dashboardStats = await getDashboardStats()
    const botStats = await getBotAnalytics(page, search)
    
    return NextResponse.json({
      ...dashboardStats,
      ...botStats
    })
  } catch (error) {
    console.error('API Error /api/lighthouse/stats:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
