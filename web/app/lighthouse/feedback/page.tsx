import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import RelativeTime from '../components/RelativeTime'

export const dynamic = 'force-dynamic'

export default async function FeedbackDashboardPage() {
  const cookieStore = await cookies()
  const hasAuth = cookieStore.get('lighthouse_auth')
  
  // Protect route
  if (!hasAuth) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      redirect('/')
    }
  }

  // Fetch feedback
  const { data: submissions, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch feedback:', error)
  }

  const badges: Record<string, string> = {
    bug: 'bg-red-500/10 text-red-500 border-red-500/20',
    suggestion: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    general: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  }

  return (
    <div className="space-y-12 max-w-5xl">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Feedback Stream Active</span>
        </div>
        <h1 className="text-5xl font-space font-bold tracking-tighter text-white uppercase">Feedback Terminal</h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">User Submissions Log</p>
      </header>

      <div className="space-y-4">
        {!submissions || submissions.length === 0 ? (
          <div className="p-20 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed flex items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">No feedback yet.</span>
          </div>
        ) : (
          <div className="grid gap-4">
            {submissions.map((item: any) => (
              <div 
                key={item.id} 
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.03] transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border ${badges[item.type] || badges.general}`}>
                        {item.type}
                      </span>
                      <span className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">
                        {item.name || 'Anonymous'}
                      </span>
                    </div>
                    
                    <p className="text-zinc-200 text-sm leading-relaxed font-sans group-hover:text-white transition-colors">
                      {item.message}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter whitespace-nowrap">
                      <RelativeTime date={item.created_at} />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
