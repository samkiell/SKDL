"use client"

import { useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

interface MediaCard {
  id: string
  title: string
  poster_url?: string
  type: 'movie' | 'series'
  quality?: string
}

export default function DiscoverGrid({ 
  initialData, 
  currentPage, 
  hasNextPage 
}: { 
  initialData: MediaCard[],
  currentPage: number,
  hasNextPage: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filter, setFilter] = useState<'ALL' | 'MOVIES' | 'SERIES'>('ALL')
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    
    timeoutRef.current = setTimeout(() => {
      if (val) {
        router.replace(`/discover?q=${encodeURIComponent(val)}`)
      } else {
        router.replace('/discover')
      }
    }, 500)
  }

  const filtered = initialData.filter(item => {
    if (filter === 'MOVIES') return item.type === 'movie'
    if (filter === 'SERIES') return item.type === 'series'
    return true
  })

  return (
    <div className="space-y-8">
      {/* Controls: Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-white/10 pb-4">
        <div className="flex gap-4 font-mono text-sm">
          {(['ALL', 'MOVIES', 'SERIES'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`transition-colors uppercase tracking-widest ${filter === tab ? 'text-[#e8ff47] font-bold' : 'text-zinc-500 hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
        </div>
        
        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Search media..."
            value={query}
            onChange={handleSearchChange}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-md px-4 py-2 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#e8ff47]/50 focus:ring-1 focus:ring-[#e8ff47]/50 transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl md:text-2xl font-medium text-zinc-400 capitalize">
              {query ? `Can't find "${query}"` : "Nothing here yet"}
            </h3>
            <p className="text-sm text-zinc-500 font-mono tracking-tight max-w-xs mx-auto">
              Our library is growing, but SKDL can find anything you need in seconds.
            </p>
          </div>
          
          <a
            href={`https://t.me/SK_DLBOT?text=${encodeURIComponent(query ? `Hey, I would like to download ${query}` : "Hey, I'm looking for a movie...")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-white text-black px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-[#e8ff47] transition-all hover:scale-105 active:scale-95"
          >
            Ask SKDL
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map(item => (
            <Link href={`/${item.id}`} key={item.id} className="group relative block aspect-[2/3] w-full overflow-hidden rounded-md bg-[#0a0a0a] border border-white/5 transition-transform duration-300 hover:scale-[1.03] hover:border-[#e8ff47]/50">
              {item.poster_url ? (
                <Image
                  src={item.poster_url}
                  alt={item.title}
                  fill
                  unoptimized
                  className="object-cover transition-opacity duration-300 group-hover:opacity-60"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                  <span className="font-bebas text-xl text-zinc-600 uppercase break-words">{item.title}</span>
                </div>
              )}
              
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="text-sm font-semibold text-white truncate">{item.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-[#e8ff47]">{item.type}</span>
                  {item.quality && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-mono">{item.quality}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(currentPage > 1 || hasNextPage) && (
        <div className="flex justify-center items-center gap-4 pt-12">
            {currentPage > 1 && (
                <button
                    onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('page', (currentPage - 1).toString())
                        router.push(`/discover?${params.toString()}`)
                    }}
                    className="flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 text-sm font-mono text-zinc-400 hover:text-white hover:border-white/20 transition-all"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    PREV
                </button>
            )}
            
            {hasNextPage && (
                <button
                    onClick={() => {
                        const params = new URLSearchParams(searchParams.toString())
                        params.set('page', (currentPage + 1).toString())
                        router.push(`/discover?${params.toString()}`)
                    }}
                    className="flex items-center gap-2 px-8 py-2 rounded-full bg-white text-black text-sm font-bold uppercase tracking-[0.2em] hover:bg-[#e8ff47] transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[#e8ff47]/20"
                >
                    NEXT
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            )}
        </div>
      )}
    </div>
  )
}
