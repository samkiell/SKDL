import { supabase } from './supabase'
import { startOfToday, subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function getDashboardStats() {
  const today = startOfToday().toISOString()
  const sevenDaysAgo = subDays(new Date(), 7).toISOString()

  try {
    // 1. Total links
    const { count: totalLinks } = await supabase
      .from('media')
      .select('*', { count: 'exact', head: true })

    // 2. Links today
    const { count: linksToday } = await supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .gte('requested_at', today)

    // 3. Active links (where expires_at > now)
    const { count: activeLinks } = await supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString())

    // 4. Last 7 days data for chart
    const { data: chartDataRaw } = await supabase
      .from('media')
      .select('requested_at')
      .gte('requested_at', sevenDaysAgo)
      .order('requested_at', { ascending: true })

    // Group by day for the last 7 days including today
    const chartData: { date: string; count: number }[] = []
    const rawData = (chartDataRaw || []) as any[]
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dayLabel = format(date, 'MMM dd')
      const targetDateStr = format(date, 'yyyy-MM-dd')
      const count = rawData.filter((row: any) => 
        format(new Date(row.requested_at), 'yyyy-MM-dd') === targetDateStr
      ).length || 0
      
      chartData.push({ date: dayLabel, count })
    }

    // 5. Content type breakdown
    const { data: typeData } = await supabase
      .from('media')
      .select('type')

    const rawTypeData = (typeData || []) as any[]
    const typesCount = [
      { name: 'Movies', value: rawTypeData.filter((r: any) => r.type === 'movie').length || 0 },
      { name: 'Series', value: rawTypeData.filter((r: any) => r.type === 'series').length || 0 }
    ]

    // 6. Recent activity (last 10)
    const { data: recentActivity } = await supabase
      .from('media')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(10)

    return {
      stats: {
        totalLinks: totalLinks || 0,
        linksToday: linksToday || 0,
        activeLinks: activeLinks || 0,
        botRequests: 0 // placeholder
      },
      chartData,
      typesCount,
      recentActivity: recentActivity || []
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      stats: { totalLinks: 0, linksToday: 0, activeLinks: 0, botRequests: 0 },
      chartData: [],
      typesCount: [],
      recentActivity: []
    }
  }
}
