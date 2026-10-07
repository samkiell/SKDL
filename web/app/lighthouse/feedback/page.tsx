'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  MessageSquare, 
  Trash2, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface FeedbackItem {
  id: string
  type: 'bug' | 'suggestion' | 'general'
  message: string
  name: string | null
  created_at: string
}

export default function FeedbackDashboardPage() {
  const [submissions, setSubmissions] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'bug' | 'suggestion' | 'general'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchFeedback = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/lighthouse/feedback')
      if (res.status === 401) {
        window.location.href = '/lighthouse/login'
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : [])
    } catch (error) {
      console.error('Failed to fetch feedback:', error)
      toast.error('Failed to load feedback stream')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeedback()
    const interval = setInterval(fetchFeedback, 30000)
    return () => clearInterval(interval)
  }, [fetchFeedback])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/lighthouse/feedback?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete')
      }
      setSubmissions(prev => prev.filter(item => item.id !== id))
      toast.success('Feedback entry dismissed')
    } catch (error) {
      console.error('Failed to delete feedback:', error)
      toast.error('Failed to dismiss feedback')
    } finally {
      setDeletingId(null)
    }
  }

  const badges: Record<string, { style: string; icon: any }> = {
    bug: { style: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle },
    suggestion: { style: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: CheckCircle2 },
    general: { style: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: HelpCircle },
  }

  const filtered = submissions.filter(item => {
    if (filter === 'all') return true
    return item.type === filter
  })

  const countFor = (t: 'all' | 'bug' | 'suggestion' | 'general') => {
    if (t === 'all') return submissions.length
    return submissions.filter(s => s.type === t).length
  }

  const formatSafeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recently'
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? 'Recently' : formatDistanceToNow(d, { addSuffix: true })
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-widest">
                Feedback Stream Active • {submissions.length} total
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-space font-bold tracking-tighter text-white uppercase">
              Feedback Terminal
            </h1>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">
              User Submissions Log (Redis Pipeline)
            </p>
          </div>

          <button
            onClick={fetchFeedback}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-mono text-zinc-300 transition-all disabled:opacity-50"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 pt-2">
          {(['all', 'bug', 'suggestion', 'general'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all uppercase tracking-wider ${
                filter === t
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10'
              }`}
            >
              {t === 'all' ? 'All' : `${t}s`} ({countFor(t)})
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-4">
        {loading && submissions.length === 0 ? (
          <div className="p-20 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              Connecting to feedback stream...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-20 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed flex flex-col items-center justify-center gap-2">
            <MessageSquare className="w-8 h-8 text-zinc-700" />
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-600">
              {filter === 'all' ? 'No feedback received yet.' : `No ${filter} entries found.`}
            </span>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(item => {
              const meta = badges[item.type] || badges.general
              const Icon = meta.icon

              return (
                <div 
                  key={item.id} 
                  className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.03] transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border ${meta.style}`}>
                          <Icon className="w-3 h-3" />
                          {item.type}
                        </span>
                        <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
                          {item.name || 'Anonymous User'}
                        </span>
                      </div>
                      
                      <p className="text-zinc-200 text-sm leading-relaxed font-sans group-hover:text-white transition-colors whitespace-pre-wrap">
                        {item.message}
                      </p>
                    </div>
                    
                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-4">
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-tighter whitespace-nowrap">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        <span>{formatSafeTime(item.created_at)}</span>
                      </div>

                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 text-[10px] font-mono transition-all disabled:opacity-50"
                        title="Dismiss feedback"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
