'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  Link2, 
  Activity, 
  ChevronRight,
  RefreshCcw,
  Zap
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import LinksChart from './components/LinksChart'
import TypeBreakdownChart from './components/TypeBreakdownChart'
import Link from 'next/link'

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/lighthouse/stats')
      const result = await res.json()
      setData(result)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch stats:', error)
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
          <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-space font-bold tracking-tighter text-white text-[10px] opacity-80">
              SKDL<span className="text-yellow-400">.</span>
            </span>
          </div>
        </div>
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] font-bold">Synchronizing Terminal...</p>
      </div>
    )
  }

  const stats = [
    { name: 'Total Links', value: data?.stats.totalLinks, icon: Link2, color: 'blue' },
    { name: 'Generated Today', value: data?.stats.linksToday, icon: Activity, color: 'emerald' },
    { name: 'Active Sessions', value: data?.stats.activeLinks, icon: Zap, color: 'amber' },
    { name: 'Bot Engine', value: 'OFFLINE', icon: BarChart3, color: 'zinc' },
  ]

  return (
    <div className="space-y-12 max-w-6xl">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">System Online</span>
          </div>
          <h1 className="text-5xl font-space font-bold tracking-tighter text-white uppercase">Command Center</h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">Global Link Distribution Network Telemetry</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 font-bold bg-zinc-900/50 px-4 py-2.5 rounded-xl border border-white/5">
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-white' : 'text-zinc-700'}`} />
          LAST SYNC: {format(lastUpdated, 'HH:mm:ss')}
        </div>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="relative group">
            <div className="p-8 rounded-xl bg-white/[0.02] border border-white/10 space-y-8 transition-all duration-500 hover:bg-white/[0.04] hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div className={`w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:bg-white/5`}>
                  <stat.icon className={`w-7 h-7 text-zinc-600 transition-colors duration-500 group-hover:text-white`} />
                </div>
                <div className="text-[10px] font-mono font-bold text-zinc-700 uppercase tracking-widest">STABLE</div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-600 group-hover:text-zinc-400 transition-colors">{stat.name}</p>
                <p className={`text-4xl font-mono font-bold tracking-tighter ${typeof stat.value === 'string' ? 'text-zinc-800 text-lg' : 'text-white'}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Signal Velocity</h2>
              <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Last 7 days of distribution analysis</p>
            </div>
            <div className="flex items-center gap-3 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-white/5">
               <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
               <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Live Flow</span>
            </div>
          </div>
          <LinksChart data={data?.chartData || []} />
        </div>

        <div className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-10">
          <div className="space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Distribution Mix</h2>
            <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Content type ratio</p>
          </div>
          <TypeBreakdownChart data={data?.typesCount || []} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-10 rounded-xl bg-white/[0.02] border border-white/10 space-y-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Active Transmissions</h2>
            <p className="text-[9px] text-zinc-700 font-mono uppercase tracking-widest">Live monitor of last 10 generated links</p>
          </div>
          <Link href="/lighthouse/links" className="text-[10px] font-mono font-bold hover:text-white transition-all flex items-center gap-2 uppercase tracking-widest text-zinc-600 group bg-zinc-900/50 px-4 py-2 rounded-xl border border-white/5 hover:border-white/20">
            Open Log Terminal <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-700 font-bold">
                <th className="pb-6 pt-0">Transmission ID</th>
                <th className="pb-6 pt-0">Subject Name</th>
                <th className="pb-6 pt-0">Class</th>
                <th className="pb-6 pt-0">Timestamp</th>
                <th className="pb-6 pt-0 text-right">TTL Monitor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.recentActivity.map((activity: any) => (
                <tr key={activity.id} className="group hover:bg-white/[0.02] transition-all duration-300">
                  <td className="py-6 font-mono text-[11px] text-zinc-600 group-hover:text-white transition-colors uppercase font-bold tracking-tighter">{activity.id}</td>
                  <td className="py-6">
                    <p className="text-sm font-bold text-zinc-200 tracking-tight group-hover:text-white transition-colors">{activity.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.2em] font-bold">{activity.quality}</span>
                       <div className="w-1 h-1 rounded-full bg-zinc-800" />
                       <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-[0.2em] font-bold">Source: MovieBox</span>
                    </div>
                  </td>
                  <td className="py-6">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-white/10 bg-white/5 text-zinc-400 group-hover:text-white transition-colors`}>
                      {activity.type === 'movie' ? 'Film' : 'Series'}
                    </span>
                  </td>
                  <td className="py-6 text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-tighter">
                    {formatDistanceToNow(new Date(activity.requested_at), { addSuffix: true })}
                  </td>
                  <td className="py-6 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono text-zinc-400 group-hover:text-white transition-colors uppercase font-bold tracking-tighter">
                        {format(new Date(activity.expires_at), 'MM/dd HH:mm')}
                      </span>
                      <div className="w-24 h-1 bg-zinc-900 rounded-full overflow-hidden">
                         <div className="h-full bg-zinc-600 rounded-full w-2/3" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
