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

    // 7. Bot Status (Heartbeat check)
    let botStatus = 'OFFLINE'
    const { data: heartbeatData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'bot_heartbeat')
      .maybeSingle()

    if (heartbeatData?.value) {
      const lastHeartbeat = new Date(heartbeatData.value)
      const diff = Date.now() - lastHeartbeat.getTime()
      if (diff < 120000) { // 2 minutes threshold
        botStatus = 'ONLINE'
      }
    }

    return {
      stats: {
        totalLinks: totalLinks || 0,
        linksToday: linksToday || 0,
        activeLinks: activeLinks || 0,
        botStatus,
        botRequests: 0 // Placeholder, updated by getBotAnalytics
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

export async function getBotAnalytics() {
  const today = startOfToday().toISOString()
  const sevenDaysAgo = subDays(new Date(), 7).toISOString()

  try {
    // 1. Overview stats
    const { count: totalRequests } = await supabase.from('bot_logs').select('*', { count: 'exact', head: true })
    const { count: requestsToday } = await supabase.from('bot_logs').select('*', { count: 'exact', head: true }).gte('created_at', today)
    const { count: requestsThisWeek } = await supabase.from('bot_logs').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)
    
    // Unique users
    const { data: usersTodayRaw } = await supabase.from('bot_logs').select('user_id').gte('created_at', today)
    const usersToday = (usersTodayRaw || []) as { user_id: number }[]
    const uniqueUsersToday = new Set(usersToday.map(u => u.user_id)).size
    
    const { data: usersTotalRaw } = await supabase.from('bot_logs').select('user_id')
    const usersTotal = (usersTotalRaw || []) as { user_id: number }[]
    const uniqueUsersTotal = new Set(usersTotal.map(u => u.user_id)).size

    // Success rate
    const { count: found } = await supabase.from('bot_logs').select('*', { count: 'exact', head: true }).eq('result_found', true)
    const successRate = totalRequests ? (found || 0) / totalRequests : 0

    // 2. Action breakdown
    const { data: actionsRaw } = await supabase.from('bot_logs').select('action')
    const actions = (actionsRaw || []) as { action: string }[]
    const actionBreakdown: Record<string, number> = {
      download_movie: 0,
      download_series: 0,
      not_found: 0,
      error: 0,
      clarification: 0
    }
    actions.forEach(a => {
      if (actionBreakdown[a.action] !== undefined) actionBreakdown[a.action]++
    })

    // 3. Last 7 days chart
    const { data: dailyDataRaw } = await supabase.from('bot_logs').select('created_at').gte('created_at', sevenDaysAgo)
    const dailyData = (dailyDataRaw || []) as { created_at: string }[]
    const requestsByDay: { date: string, count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count = dailyData.filter(r => format(new Date(r.created_at), 'yyyy-MM-dd') === dateStr).length || 0
      requestsByDay.push({ date: format(date, 'MMM dd'), count })
    }

    // 4. Top movies & users
    const { data: logsForAggRaw } = await supabase.from('bot_logs').select('result_title, user_id, username, display_name')
    const logsForAgg = (logsForAggRaw || []) as { result_title: string | null, user_id: number, username: string | null, display_name: string | null }[]
    
    const movieCounts: Record<string, number> = {}
    const userCounts: Record<string, { count: number, name: string }> = {}
    
    logsForAgg.forEach(log => {
      if (log.result_title) {
        movieCounts[log.result_title] = (movieCounts[log.result_title] || 0) + 1
      }
      const userId = log.user_id.toString()
      if (!userCounts[userId]) {
        userCounts[userId] = { count: 0, name: log.username || log.display_name || userId }
      }
      userCounts[userId].count++
    })

    const topMovies = Object.entries(movieCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topUsers = Object.entries(userCounts)
      .map(([_, data]) => ({ username: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 5. Recent 20
    const { data: recent } = await supabase
      .from('bot_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    return {
      overview: {
        total_requests: totalRequests || 0,
        requests_today: requestsToday || 0,
        requests_this_week: requestsThisWeek || 0,
        unique_users_today: uniqueUsersToday,
        unique_users_total: uniqueUsersTotal,
        success_rate: successRate
      },
      action_breakdown: actionBreakdown,
      requests_by_day: requestsByDay,
      top_movies: topMovies,
      top_users: topUsers,
      recent: recent || []
    }
  } catch (error) {
    console.error('Error fetching bot analytics:', error)
    return {
      overview: { total_requests: 0, requests_today: 0, requests_this_week: 0, unique_users_today: 0, unique_users_total: 0, success_rate: 0 },
      action_breakdown: { download_movie: 0, download_series: 0, not_found: 0, error: 0, clarification: 0 },
      requests_by_day: [],
      top_movies: [],
      top_users: [],
      recent: []
    }
  }
}
