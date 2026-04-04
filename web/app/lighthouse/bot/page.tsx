'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  Users, 
  Zap, 
  MessageSquare,
  Activity,
  ArrowUpRight,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCcw
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { format, formatDistanceToNow } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function BotActivityPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/lighthouse/stats')
      if (res.status === 401) {
        window.location.href = '/lighthouse/login'
        return
      }
      const result = await res.json()
      setData(result)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch bot analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-t-2 border-white animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-space font-bold tracking-tighter text-white text-[10px] opacity-80">
              SKDL<span className="text-yellow-400">.</span>
            </span>
          </div>
        </div>
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] font-bold">Synchronizing Bot Telemetry...</p>
      </div>
    )
  }

  const statCards = [
    { 
      name: 'Total Requests', 
      value: data?.overview.total_requests.toLocaleString(), 
      icon: MessageSquare,
      sub: `${data?.overview.requests_this_week} this week`
    },
    { 
      name: 'Requests Today', 
      value: data?.overview.requests_today, 
      icon: Activity,
      sub: 'Last 24 hours'
    },
    { 
      name: 'Unique Users', 
      value: data?.overview.unique_users_today, 
      icon: Users,
      sub: `${data?.overview.unique_users_total} total users`
    },
    { 
      name: 'Success Rate', 
      value: `${(data?.overview.success_rate * 100).toFixed(1)}%`, 
      icon: Zap,
      sub: 'Result found'
    },
  ]

  const actionData = Object.entries(data?.action_breakdown || {}).map(([name, value]) => ({
    name: name.replace('_', ' ').toUpperCase(),
    value
  }))

  const COLORS = ['#ffffff', '#a1a1aa', '#52525b', '#3f3f46', '#27272a']

  return (
    <div className="space-y-12 max-w-6xl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Live Telemetry</span>
          </div>
          <h1 className="text-5xl font-space font-bold tracking-tighter text-white uppercase">Bot Engine</h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">Signal Interpretation & Processing Intelligence</p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 font-bold bg-zinc-900/50 px-4 py-2.5 rounded-xl border border-white/5">
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-white' : 'text-zinc-700'}`} />
            STREAMS SYNCED: {format(lastUpdated, 'HH:mm:ss')}
          </div>
          <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Auto-refresh active (30s)</p>
        </div>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="p-8 rounded-xl bg-white/[0.02] border border-white/10 space-y-6 group hover:bg-white/[0.04] transition-all duration-500">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                <stat.icon className="w-6 h-6 text-zinc-600 group-hover:text-white" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-800" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-600">{stat.name}</p>
              <p className="text-3xl font-mono font-bold tracking-tighter text-white">{stat.value}</p>
              <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-8">
          <div className="space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Request Velocity</h2>
            <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Volume of incoming signals — 7 Day window</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.requests_by_day || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#3f3f46" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#3f3f46" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: '10px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="count" fill="#ffffff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-8">
          <div className="space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Action Distribution</h2>
            <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Intent classification ratio</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={actionData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {actionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', fontSize: '10px', fontFamily: 'monospace' }}
                />
                <Legend 
                   layout="vertical" 
                   verticalAlign="middle" 
                   align="right"
                   formatter={(value) => <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-8">
           <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Subject Hotlist</h2>
              <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Top 10 requested movies & series</p>
            </div>
            <Search className="w-4 h-4 text-zinc-800" />
          </div>
          <div className="space-y-2">
            {data?.top_movies.length > 0 ? data.top_movies.map((movie: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.01] border border-white/5 group hover:bg-white/5 transition-all">
                <span className="text-xs font-bold text-zinc-300 group-hover:text-white truncate max-w-[250px]">{movie.title}</span>
                <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-white/5">{movie.count} REQS</span>
              </div>
            )) : (
              <p className="text-[10px] font-mono text-zinc-800 uppercase text-center py-10">No data available in signal buffer</p>
            )}
          </div>
        </div>

        <div className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-8">
           <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">High-Traffic Nodes</h2>
              <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Top 10 unique user interaction points</p>
            </div>
            <Users className="w-4 h-4 text-zinc-800" />
          </div>
          <div className="space-y-2">
             {data?.top_users.length > 0 ? data.top_users.map((user: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.01] border border-white/5 group hover:bg-white/5 transition-all">
                <span className="text-xs font-bold text-zinc-300 group-hover:text-white">@{user.username}</span>
                <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded border border-white/5">{user.count} ACTIONS</span>
              </div>
            )) : (
              <p className="text-[10px] font-mono text-zinc-800 uppercase text-center py-10">No user data synchronized</p>
            )}
          </div>
        </div>
      </div>

      {/* Live Request Feed */}
      <div className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Live Signal Monitor</h2>
            <p className="text-[9px] text-zinc-700 font-mono uppercase tracking-widest">Last 20 interpreted bot instructions</p>
          </div>
          <div className="px-4 py-2 bg-zinc-950 border border-white/10 rounded-xl text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            {data?.recent.length || 0} IN BUFFER
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-700 font-bold">
                <th className="pb-6 pt-0">Timestamp</th>
                <th className="pb-6 pt-0">Identity</th>
                <th className="pb-6 pt-0">Action</th>
                <th className="pb-6 pt-0">Interpreted Query</th>
                <th className="pb-6 pt-0">Resolution</th>
                <th className="pb-6 pt-0 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.recent.length > 0 ? data.recent.map((log: any) => (
                <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="py-6 text-[10px] font-mono text-zinc-600 uppercase font-bold tabular-nums">
                    {format(new Date(log.created_at), 'HH:mm:ss')}
                  </td>
                  <td className="py-6 text-xs text-zinc-400 font-bold">
                    <div className="flex flex-col">
                      <span className="text-zinc-200">@{log.username || 'unknown'}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">{log.display_name || log.user_id}</span>
                    </div>
                  </td>
                  <td className="py-6">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="py-6 text-xs text-zinc-400 italic max-w-[200px] truncate">
                    "{log.query || '—'}"
                  </td>
                  <td className="py-6">
                    <div className="flex items-center gap-2">
                       {log.result_found ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-white" />
                          <span className="text-xs font-bold text-zinc-200 truncate max-w-[150px]">{log.result_title}</span>
                        </>
                      ) : log.action === 'clarification' ? (
                        <>
                          <HelpCircle className="w-3 h-3 text-zinc-600" />
                          <span className="text-xs text-zinc-600 uppercase font-mono font-bold tracking-tighter">CLARIFY SENT</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-zinc-800" />
                          <span className="text-xs text-zinc-800 uppercase font-mono font-bold tracking-tighter">UNRESOLVED</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-6 text-right font-mono text-[10px] text-zinc-600 tabular-nums font-bold">
                    {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-[10px] font-mono text-zinc-800 uppercase tracking-widest">
                    Buffer Empty — Awaiting initial signals
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const configs: Record<string, { label: string, classes: string }> = {
    download_movie: { label: 'MOVIE_DL', classes: 'border-zinc-700 bg-zinc-900 text-white' },
    download_series: { label: 'SERIES_DL', classes: 'border-zinc-800 bg-zinc-950 text-zinc-400' },
    not_found: { label: 'NOT_FOUND', classes: 'border-zinc-900 bg-black text-zinc-600' },
    error: { label: 'FAILURE', classes: 'border-red-950 bg-red-950/20 text-red-800' },
    clarification: { label: 'CLARIFY', classes: 'border-zinc-800/50 bg-zinc-900/50 text-zinc-500' },
  }

  const config = configs[action] || { label: action.toUpperCase(), classes: 'border-zinc-800 bg-zinc-900 text-zinc-600' }

  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest border",
      config.classes
    )}>
      {config.label}
    </span>
  )
}
