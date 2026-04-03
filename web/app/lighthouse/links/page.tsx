'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Trash2, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react'
import { format } from 'date-fns'

export default function LinksPage() {
  const [links, setLinks] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fetchLinks = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lighthouse/links?page=${page}&search=${search}`)
      const data = await res.json()
      setLinks(data.links)
      setTotal(data.total)
    } catch (error) {
      console.error('Failed to fetch links:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchLinks, 500)
    return () => clearTimeout(timer)
  }, [page, search])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/lighthouse/links?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLinks(links.filter(l => l.id !== id))
        setConfirmDelete(null)
      }
    } catch (error) {
      console.error('Failed to delete link:', error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-10 max-w-6xl">
      <header className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-space font-bold tracking-tighter text-white uppercase italic">Central Registry</h1>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">Signal Log Distribution Database</p>
          </div>
          <div className="flex items-center gap-4 bg-[#080808] px-6 py-3 rounded-2xl border border-white/5 font-mono text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
            Total Valid Records: <span className="text-blue-500">{total}</span>
          </div>
        </div>

        <div className="relative group max-w-xl">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500">
            <Search className="w-4 h-4 text-zinc-600" />
          </div>
          <input
            type="text"
            placeholder="Search by Transmission ID or Subject Title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#080808] border border-white/5 rounded-3xl py-5 pl-14 pr-8 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all font-mono uppercase tracking-[0.1em] placeholder:text-zinc-700"
          />
        </div>
      </header>

      <div className="rounded-[2.5rem] bg-[#080808] border border-white/5 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-700 font-bold">
                <th className="p-10 pb-6 whitespace-nowrap">ID Code</th>
                <th className="p-10 pb-6 whitespace-nowrap">Signal Profile</th>
                <th className="p-10 pb-6 whitespace-nowrap">Timestamp</th>
                <th className="p-10 pb-6 whitespace-nowrap">TTL Matrix</th>
                <th className="p-10 pb-6 text-right whitespace-nowrap">Commands</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-32 text-center text-zinc-800 font-mono text-[10px] animate-pulse uppercase tracking-[0.5em] font-bold">
                    Scanning Blocks...
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-32 text-center text-zinc-800 font-mono text-[10px] uppercase tracking-[0.5em] font-bold italic">
                    Log Clear / No Signals Detected
                  </td>
                </tr>
              ) : links.map((link) => (
                <tr key={link.id} className="group hover:bg-white/[0.02] transition-all duration-300">
                  <td className="p-10 align-middle">
                    <span className="font-mono text-[11px] text-zinc-600 font-bold transition-all group-hover:text-blue-500 uppercase tracking-tighter">{link.id}</span>
                  </td>
                  <td className="p-10 align-middle">
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-zinc-200 tracking-tight leading-none group-hover:text-white transition-colors">{link.title}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border border-current opacity-60 ${link.type === 'movie' ? 'text-blue-400' : 'text-indigo-400'}`}>
                          {link.type === 'movie' ? 'Film' : 'Series'}
                        </span>
                        <span className="text-[9px] text-zinc-700 font-mono uppercase tracking-widest font-bold italic">{link.quality}</span>
                        {link.season && (
                          <span className="text-[9px] text-zinc-600 font-mono uppercase font-bold tracking-tighter">
                            S{link.season.toString().padStart(2, '0')}E{link.episode.toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-10 align-middle">
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 font-mono font-bold tracking-tighter">
                        {format(new Date(link.requested_at), 'yyyy/MM/dd')}
                      </p>
                      <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-[0.1em] font-bold italic">
                        {format(new Date(link.requested_at), 'HH:mm:ss')}
                      </p>
                    </div>
                  </td>
                  <td className="p-10 align-middle">
                    <div className="space-y-1">
                       <p className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 uppercase font-bold tracking-tighter transition-colors">
                        {format(new Date(link.expires_at), 'yyyy/MM/dd')}
                      </p>
                      <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-700 font-bold uppercase tracking-widest">
                         <div className="w-1 h-1 rounded-full bg-blue-500 opacity-30" />
                         {format(new Date(link.expires_at), 'HH:mm:ss')}
                      </div>
                    </div>
                  </td>
                  <td className="p-10 align-middle text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                      <a
                        href={`/${link.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-500 transition-all duration-300 hover:scale-110 active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      
                      {confirmDelete === link.id ? (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-1 animate-in zoom-in duration-300">
                          <button
                            onClick={() => handleDelete(link.id)}
                            disabled={deletingId === link.id}
                            className="px-4 py-2 text-[9px] font-bold text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all uppercase tracking-widest"
                          >
                            RUN DELETE
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-3 py-2 text-[9px] font-bold text-zinc-600 hover:text-zinc-400 rounded-lg uppercase tracking-widest"
                          >
                            CANCEL
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(link.id)}
                          className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center text-zinc-700 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transition-all duration-300 hover:scale-110 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-10 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-6 py-3.5 bg-[#0a0a0a] border border-white/5 rounded-2xl text-[9px] font-mono font-bold tracking-[0.2em] text-zinc-600 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center gap-2 uppercase group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> PREV BLOCK
            </button>
            <div className="px-6 py-3 bg-zinc-900/40 rounded-xl border border-white/5">
               <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-zinc-600 font-bold">
                 LOG BLOCK <span className="text-white mx-1">{page}</span> / <span className="text-zinc-400">{Math.ceil(total / 25)}</span>
               </div>
            </div>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={links.length < 25 || loading}
              className="px-6 py-3.5 bg-[#0a0a0a] border border-white/5 rounded-2xl text-[9px] font-mono font-bold tracking-[0.2em] text-zinc-600 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center gap-2 uppercase group"
            >
              NEXT BLOCK <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          
          <div className="hidden lg:flex flex-col items-end gap-2 pr-4">
            <div className="flex gap-1 h-0.5 w-40 bg-zinc-900 overflow-hidden">
               <div 
                 className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]" 
                 style={{ width: `${(page / Math.ceil(total / 25)) * 100}%` }} 
               />
            </div>
            <span className="text-[8px] font-mono text-zinc-800 uppercase tracking-widest font-bold italic tracking-[0.4em]">Signal Buffer Monitor</span>
          </div>
        </div>
      </div>
    </div>
  )
}
