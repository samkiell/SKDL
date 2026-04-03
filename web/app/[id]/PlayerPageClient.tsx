'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import AdBanner from '../components/AdBanner'

// Dynamically import PlayerClient with SSR disabled to fix "document is not defined" error
const PlayerClient = dynamic(() => import('./PlayerClient'), { ssr: false })

interface MediaRow {
  id: string
  title: string
  cdn_url: string
  type: 'movie' | 'series'
  quality: string
  season: number | null
  episode: number | null
  expires_at: string
  subject_id?: string
  poster_url?: string
  description?: string
  imdb_id?: string
}

function mediaMetaLine(row: MediaRow): string {
  const bits: string[] = []
  bits.push(row.type === 'series' ? 'Series' : 'Movie')
  if (row.type === 'series' && row.season && row.episode) {
    bits.push(`S${row.season.toString().padStart(2, '0')}E${row.episode.toString().padStart(2, '0')}`)
  }
  if (row.quality) {
    bits.push(row.quality)
  }
  return bits.join(' • ')
}

export default function PlayerPageClient({ row, proxyUrl }: { row: MediaRow; proxyUrl: string }) {
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null)

  const handleDownloadMp4 = () => {
    const url = `/download/${row.id}?type=mp4&title=${encodeURIComponent(row.title)}&poster=${encodeURIComponent(row.poster_url || '')}`
    window.location.href = url
  }

  const handleDownloadMkv = () => {
    const url = `/download/${row.id}?type=mkv&title=${encodeURIComponent(row.title)}&poster=${encodeURIComponent(row.poster_url || '')}`
    window.location.href = url
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-8 md:pt-12 pb-24 px-4 md:px-6 font-sans">
      <div className="w-full max-w-4xl space-y-8">
        
        {/* Player Container */}
        <div className="space-y-4">
          <PlayerClient 
            proxyUrl={proxyUrl} 
            imdbId={row.imdb_id} 
            query={row.title}
            onSubtitleFound={(url) => setSubtitleUrl(url)} 
          />

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0a0a0a] border border-white/5 p-5 rounded-xl">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{row.title}</h1>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                {row.type === 'series' ? 'Series' : 'Movie'} • {row.quality} 
                {row.type === 'series' && row.season && row.episode && ` • S${row.season.toString().padStart(2, '0')}E${row.episode.toString().padStart(2, '0')}`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                    onClick={handleDownloadMp4}
                    className="flex-1 sm:flex-none flex justify-center items-center bg-zinc-900 border border-white/10 text-white text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-zinc-800 transition-colors uppercase tracking-wider"
                >
                    Download MP4
                </button>

                <button
                    onClick={handleDownloadMkv}
                    className="flex-1 sm:flex-none flex justify-center items-center bg-white text-black text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-zinc-200 transition-colors uppercase tracking-wider disabled:opacity-50"
                >
                    Download MKV + Subs
                </button>
            </div>
          </div>
        </div>

        {/* Ad Placement */}
        <div className="w-full">
          <AdBanner />
        </div>

        {/* Info / Description Section */}
        <div className="grid md:grid-cols-[1fr_2fr] gap-8 pt-4">
          {row.poster_url && (
            <div className="hidden md:block w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/10 shadow-2xl">
              <img src={row.poster_url} alt={row.title} className="w-full h-full object-cover" />
            </div>
          )}
          
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Description</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                {row.description || "No description available for this title."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-8">
              <div className="space-y-1">
                <h4 className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Quality</h4>
                <p className="text-sm font-medium">{row.quality}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Expires</h4>
                <p className="text-sm font-medium">{new Date(row.expires_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
