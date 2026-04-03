"use client"

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface MediaCard {
  id: string
  title: string
  poster_url?: string
  type: 'movie' | 'series'
  quality?: string
}

export default function DiscoverGrid({ initialData }: { initialData: MediaCard[] }) {
  const [filter, setFilter] = useState<'ALL' | 'MOVIES' | 'SERIES'>('ALL')

  const filtered = initialData.filter(item => {
    if (filter === 'MOVIES') return item.type === 'movie'
    if (filter === 'SERIES') return item.type === 'series'
    return true
  })

  return (
    <div className="space-y-8">
      {/* Filter Tabs */}
      <div className="flex gap-4 border-b border-white/10 pb-4 font-mono text-sm">
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-zinc-500 font-mono py-12">
          Nothing here yet — request something via @SK_DLBOT.
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
    </div>
  )
}
