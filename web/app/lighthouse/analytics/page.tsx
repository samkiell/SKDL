import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTrafficStats } from '@/lib/analytics'
import { 
  Users, 
  Download, 
  Layers, 
  PieChart as PieChartIcon, 
  BarChart3, 
  TrendingUp, 
  Globe,
  Clock,
  RefreshCcw,
  Film,
  Monitor
} from 'lucide-react'
import { format } from 'date-fns'
import VisitsChart from '@/components/lighthouse/VisitsChart'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const cookieStore = await cookies()
  const auth = cookieStore.get('lighthouse_auth')?.value

  if (auth !== 'true') {
    redirect('/lighthouse/login')
  }

  const { visits, downloads, dailyVisits, topPages, topDownloads, formatBreakdown, typeBreakdown } =
    await getTrafficStats()

  const stats = [
    { label: 'Visits Today', value: visits.today, icon: Globe, color: 'text-blue-400' },
    { label: 'Visits 7D', value: visits.week, icon: TrendingUp, color: 'text-indigo-400' },
    { label: 'Visits 30D', value: visits.month, icon: Users, color: 'text-purple-400' },
    { label: 'Downloads Today', value: downloads.today, icon: Download, color: 'text-emerald-400' },
    { label: 'Downloads 7D', value: downloads.week, icon: RefreshCcw, color: 'text-teal-400' },
    { label: 'Downloads 30D', value: downloads.month, icon: Layers, color: 'text-cyan-400' },
  ]

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-space font-bold tracking-tighter text-white uppercase">Traffic Analytics</h1>
          <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em] font-black">Performance & Engagement Metrics</p>
        </div>
        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest bg-zinc-950/50 px-4 py-2 rounded-lg border border-white/5 flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Last Updated: {format(new Date(), 'HH:mm:ss')}
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-zinc-950/50 border border-white/5 p-6 rounded-2xl space-y-4 hover:border-white/10 transition-colors">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <div className="space-y-1">
              <p className="text-2xl font-mono font-bold text-white tracking-tighter">{(stat.value || 0).toLocaleString()}</p>
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 font-bold">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">Visit Velocity (30 Days)</h2>
        </div>
        <VisitsChart data={dailyVisits} />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Pages */}
        <div className="bg-zinc-950/50 border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Top Destinations</h3>
            <Globe className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.02] text-zinc-600 uppercase">
                <tr>
                  <th className="px-6 py-4">Path</th>
                  <th className="px-6 py-4 text-right">Visits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topPages.map((page) => (
                  <tr key={page.path} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4 text-zinc-400 truncate max-w-[200px]">{page.path}</td>
                    <td className="px-6 py-4 text-right text-white font-bold">{(page.visits || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Downloads */}
        <div className="bg-zinc-950/50 border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">High Demand Media</h3>
            <Download className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.02] text-zinc-600 uppercase">
                <tr>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Hits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topDownloads.map((dl) => (
                  <tr key={dl.title} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4 text-zinc-400 truncate max-w-[150px]">{dl.title}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full border border-white/5 bg-white/5 text-[8px] uppercase">
                        {dl.media_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-white font-bold">{(dl.download_count || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Format Breakdown */}
        <div className="bg-zinc-950/50 border border-white/5 rounded-2xl p-8 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Resource Formats</h3>
              <Layers className="w-4 h-4 text-zinc-700" />
           </div>
           <div className="flex items-center gap-2 h-3 rounded-full overflow-hidden bg-zinc-900">
              {Object.entries(formatBreakdown as Record<string, number>).map(([fmt, count], idx) => {
                const colors = ['bg-[#e8ff47]', 'bg-zinc-400', 'bg-zinc-700']
                const total = Object.values(formatBreakdown as Record<string, number>).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div 
                    key={fmt} 
                    style={{ width: `${pct}%` }} 
                    className={`${colors[idx % colors.length]} h-full transition-all`}
                    title={`${fmt.toUpperCase()}: ${pct.toFixed(1)}%`}
                  />
                )
              })}
           </div>
           <div className="flex flex-wrap gap-6">
              {Object.entries(formatBreakdown as Record<string, number>).map(([fmt, count], idx) => {
                const colors = ['bg-[#e8ff47]', 'bg-zinc-400', 'bg-zinc-700']
                return (
                  <div key={fmt} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{fmt}: {count}</span>
                  </div>
                )
              })}
           </div>
        </div>

        {/* Media Type Breakdown */}
        <div className="bg-zinc-950/50 border border-white/5 rounded-2xl p-8 space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Content Classification</h3>
              <PieChartIcon className="w-4 h-4 text-zinc-700" />
           </div>
           <div className="flex items-center gap-2 h-3 rounded-full overflow-hidden bg-zinc-900">
              {Object.entries(typeBreakdown as Record<string, number>).map(([type, count], idx) => {
                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-zinc-700']
                const total = Object.values(typeBreakdown as Record<string, number>).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div 
                    key={type} 
                    style={{ width: `${pct}%` }} 
                    className={`${colors[idx % colors.length]} h-full transition-all`}
                  />
                )
              })}
           </div>
           <div className="flex flex-wrap gap-6">
              {Object.entries(typeBreakdown as Record<string, number>).map(([type, count], idx) => {
                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-zinc-700']
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{type}: {count}</span>
                  </div>
                )
              })}
           </div>
        </div>
      </div>
    </div>
  )
}
