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
  size?: number
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return gb.toFixed(2) + 'GB'
  const mb = bytes / (1024 * 1024)
  return mb.toFixed(1) + 'MB'
}

export default function PlayerPageClient({ row, proxyUrl }: { row: MediaRow; proxyUrl: string }) {
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null)
  const [posterUrl] = useState<string | undefined>(row.poster_url)

  const safeFilename = row.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
  const displayFilename = row.type === 'series' 
    ? `${safeFilename} S${row.season?.toString().padStart(2, '0')}E${row.episode?.toString().padStart(2, '0')}`
    : safeFilename

  const handleDownloadMp4 = () => {
    const url = `/download/${row.id}?type=mp4&title=${encodeURIComponent(row.title)}&poster=${encodeURIComponent(posterUrl || '')}`
    window.location.href = url
  }

  const handleDownloadMkv = () => {
    const url = `/download/${row.id}?type=mkv&title=${encodeURIComponent(row.title)}&poster=${encodeURIComponent(posterUrl || '')}`
    window.location.href = url
  }

  // Build metadata line without "double dots"
  const metaBits: string[] = []
  metaBits.push(row.type === 'series' ? 'Series' : 'Movie')
  if (row.type === 'series' && row.season && row.episode) {
    metaBits.push(`S${row.season.toString().padStart(2, '0')}E${row.episode.toString().padStart(2, '0')}`)
  }
  if (row.quality) {
    metaBits.push(row.quality)
  }
  const sizeStr = formatSize(row.size)
  if (sizeStr) {
    metaBits.push(sizeStr)
  }
  const metaLine = metaBits.join(' • ')

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-8 md:pt-16 pb-24 px-4 md:px-6 font-sans">
      <div className="w-full max-w-5xl space-y-12">
        
        {/* Header Section with Integrated Poster Thumbnail */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          {posterUrl && (
            <div className="flex-shrink-0 w-32 md:w-44 aspect-[2/3] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-zinc-950 self-center md:self-start">
              <img src={posterUrl} alt={row.title} className="w-full h-full object-cover" />
            </div>
          )}
          
          <div className="space-y-6 flex-1 text-center md:text-left flex flex-col justify-center h-full py-2">
            <div className="space-y-2">
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.4em] font-bold">
                STREAMING_SOURCE // SKDL_PRO
              </p>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-white leading-tight">
                {row.title}
              </h1>
              <p className="text-xs md:text-sm font-mono text-zinc-500 uppercase tracking-[0.2em] font-medium pt-2">
                  {metaLine}
              </p>
            </div>
            
            {/* Quick Actions (Optional, but makes it feel like a dashboard) */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
               {/* Any badges like 4K, HDR, etc could go here */}
            </div>
          </div>
        </div>

        {/* Player Container */}
        <div className="space-y-8">
          <div className="w-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden border border-white/5 bg-black">
            <PlayerClient 
              proxyUrl={proxyUrl} 
              imdbId={row.imdb_id} 
              query={displayFilename}
              onSubtitleFound={(url) => setSubtitleUrl(url)} 
            />
          </div>

          <div className="flex flex-col items-center space-y-10 py-4">
              <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-4">
                  <button
                      onClick={handleDownloadMp4}
                      className="flex-1 flex justify-center items-center bg-[#121212] border border-white/10 text-white text-xs md:text-sm font-black px-8 py-5 rounded-lg hover:bg-zinc-800 transition-all uppercase tracking-[0.2em] font-mono"
                  >
                      DOWNLOAD MP4
                  </button>

                  <button
                      onClick={handleDownloadMkv}
                      className="flex-1 flex justify-center items-center bg-white text-black text-xs md:text-sm font-black px-8 py-5 rounded-lg hover:bg-zinc-100 transition-all uppercase tracking-[0.2em] font-mono shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                      DOWNLOAD MKV + SUBS
                  </button>
              </div>

              {subtitleUrl && (
                  <div className="text-center">
                      <a 
                          href={`/api/proxy?url=${encodeURIComponent(subtitleUrl)}&filename=${encodeURIComponent(displayFilename)}.srt&dl=1`} 
                          className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors underline underline-offset-8 decoration-zinc-800 uppercase tracking-widest"
                      >
                          ↓ Download Subtitles (.srt)
                      </a>
                  </div>
              )}

              <div className="pt-4">
                  <a
                      href="https://t.me/SK_DLBOT"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors uppercase tracking-[0.3em] font-bold"
                  >
                      Request Another on Telegram →
                  </a>
              </div>
          </div>
        </div>

        {/* Ad Placement Bottom */}
        <div className="w-full opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          <AdBanner />
        </div>
      </div>
    </div>
  )
}
