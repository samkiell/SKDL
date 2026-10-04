import { getRedisClient } from './redis'
import { startOfToday, subDays, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function getDashboardStats() {
  try {
    const redis = getRedisClient()

    // 1. Total media counter
    const totalLinks = (await redis.get<number>('stats:total_media')) || 0

    // 2. Recent media
    const rawRecent = await redis.lrange<any>('media:recent', 0, 99)
    const recentMedia = (rawRecent || []).map(r => {
      const item = typeof r === 'string' ? JSON.parse(r) : { ...r }
      if (!item.requested_at) {
        item.requested_at = item.created_at || new Date().toISOString()
      }
      if (!item.expires_at) {
        item.expires_at = new Date(Date.now() + 6 * 3600 * 1000).toISOString()
      }
      return item
    })

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const now = new Date().getTime()

    const linksToday = recentMedia.filter(
      r => r.requested_at && format(new Date(r.requested_at), 'yyyy-MM-dd') === todayStr
    ).length

    const activeLinks = recentMedia.filter(
      r => r.expires_at && new Date(r.expires_at).getTime() > now
    ).length

    // 3. Chart data for last 7 days
    const chartData: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dayLabel = format(date, 'MMM dd')
      const targetDateStr = format(date, 'yyyy-MM-dd')
      const count = recentMedia.filter(
        r => r.requested_at && format(new Date(r.requested_at), 'yyyy-MM-dd') === targetDateStr
      ).length
      chartData.push({ date: dayLabel, count })
    }

    // 4. Content type breakdown
    const typesCount = [
      { name: 'Movies', value: recentMedia.filter(r => r.type === 'movie').length },
      { name: 'Series', value: recentMedia.filter(r => r.type === 'series').length },
    ]

    // 5. Bot Status (Heartbeat check)
    let botStatus = 'OFFLINE'
    const heartbeat = await redis.get<string>('bot:heartbeat')
    if (heartbeat) {
      const lastHeartbeat = new Date(heartbeat).getTime()
      if (Date.now() - lastHeartbeat < 120000) {
        botStatus = 'ONLINE'
      }
    }

    return {
      stats: {
        totalLinks: totalLinks || recentMedia.length,
        linksToday,
        activeLinks,
        botStatus,
        botRequests: (await redis.get<number>('stats:total_requests')) || 0,
      },
      chartData,
      typesCount,
      recentActivity: recentMedia.slice(0, 10),
    }
  } catch (error) {
    console.error('Error fetching dashboard stats from Redis:', error)
    return {
      stats: { totalLinks: 0, linksToday: 0, activeLinks: 0, botStatus: 'OFFLINE', botRequests: 0 },
      chartData: [],
      typesCount: [],
      recentActivity: [],
    }
  }
}

export async function getBotAnalytics(page = 1, search = '') {
  try {
    const redis = getRedisClient()
    const rawLogs = await redis.lrange<any>('bot_logs', 0, 999)
    const logs = (rawLogs || []).map(r => (typeof r === 'string' ? JSON.parse(r) : r))

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const sevenDaysAgo = subDays(new Date(), 7).getTime()

    const totalRequests = (await redis.get<number>('stats:total_requests')) || logs.length
    const requestsToday = logs.filter(
      l => l.created_at && format(new Date(l.created_at), 'yyyy-MM-dd') === todayStr
    ).length
    const requestsThisWeek = logs.filter(
      l => l.created_at && new Date(l.created_at).getTime() >= sevenDaysAgo
    ).length

    const usersToday = new Set(
      logs
        .filter(l => l.created_at && format(new Date(l.created_at), 'yyyy-MM-dd') === todayStr)
        .map(l => l.user_id)
    ).size

    const uniqueUsersTotal = new Set(logs.map(l => l.user_id)).size
    const foundCount = logs.filter(l => l.result_found).length
    const successRate = totalRequests ? foundCount / totalRequests : 0

    // Action breakdown
    const actionBreakdown: Record<string, number> = {
      download_movie: 0,
      download_series: 0,
      not_found: 0,
      error: 0,
      clarification: 0,
    }
    logs.forEach(l => {
      if (l.action && actionBreakdown[l.action] !== undefined) {
        actionBreakdown[l.action]++
      }
    })

    // Last 7 days chart
    const requestsByDay: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count = logs.filter(
        l => l.created_at && format(new Date(l.created_at), 'yyyy-MM-dd') === dateStr
      ).length
      requestsByDay.push({ date: format(date, 'MMM dd'), count })
    }

    // Top movies & users
    const movieCounts: Record<string, number> = {}
    const userCounts: Record<string, { count: number; name: string }> = {}

    logs.forEach(log => {
      if (log.result_title) {
        movieCounts[log.result_title] = (movieCounts[log.result_title] || 0) + 1
      }
      if (log.user_id) {
        const userId = log.user_id.toString()
        if (!userCounts[userId]) {
          userCounts[userId] = { count: 0, name: log.username || log.display_name || userId }
        }
        userCounts[userId].count++
      }
    })

    const topMovies = Object.entries(movieCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topUsers = Object.entries(userCounts)
      .map(([_, data]) => ({ username: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Filter & Paginate
    let filteredLogs = logs
    if (search && search.trim() !== '') {
      const s = search.trim().toLowerCase()
      filteredLogs = logs.filter(l =>
        (l.username && l.username.toLowerCase().includes(s)) ||
        (l.display_name && l.display_name.toLowerCase().includes(s)) ||
        (l.result_title && l.result_title.toLowerCase().includes(s)) ||
        (l.query && l.query.toLowerCase().includes(s))
      )
    }

    const pageSize = 20
    const offset = (page - 1) * pageSize
    const recent = filteredLogs.slice(offset, offset + pageSize)

    return {
      overview: {
        total_requests: totalRequests,
        requests_today: requestsToday,
        requests_this_week: requestsThisWeek,
        unique_users_today: usersToday,
        unique_users_total: uniqueUsersTotal,
        success_rate: successRate,
      },
      action_breakdown: actionBreakdown,
      requests_by_day: requestsByDay,
      top_movies: topMovies,
      top_users: topUsers,
      recent,
    }
  } catch (error) {
    console.error('Error fetching bot analytics from Redis:', error)
    return {
      overview: { total_requests: 0, requests_today: 0, requests_this_week: 0, unique_users_today: 0, unique_users_total: 0, success_rate: 0 },
      action_breakdown: { download_movie: 0, download_series: 0, not_found: 0, error: 0, clarification: 0 },
      requests_by_day: [],
      top_movies: [],
      top_users: [],
      recent: [],
    }
  }
}
