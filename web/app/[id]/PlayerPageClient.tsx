'use client'

import { useState, useEffect, useMemo } from 'react'
import PlayerClient from './PlayerClient'
import AdBanner from '../components/AdBanner'
import { Share2, Check } from 'lucide-react'
import { Toaster, toast } from 'sonner'

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
  if (!bytes || bytes <= 0) return ''
  
  // If the number is small (e.g., < 10,000), it's likely already in MB from the source API
  let b = bytes
  if (b < 100000 && b > 0) {
      b = b * 1024 * 1024
  }

  const gb = b / (1024 * 1024 * 1024)
  if (gb >= 1) return gb.toFixed(2) + ' GB'
  const mb = b / (1024 * 1024)
  if (mb >= 1) return mb.toFixed(1) + ' MB'
  return b + ' B'
}

export default function PlayerPageClient({ row, proxyUrl }: { row: MediaRow; proxyUrl: string }) {
  const [isMounted, setIsMounted] = useState(false)
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null)
  const [posterUrl] = useState<string | undefined>(row.poster_url)
  const [tagline] = useState('SKDL_stream // encrypted with beans')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const displayFilename = useMemo(() => {
     const safe = row.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
     return row.type === 'series' 
        ? `${safe} S${row.season?.toString().padStart(2, '0')}E${row.episode?.toString().padStart(2, '0')}`
        : safe
  }, [row.title, row.type, row.season, row.episode])

  const brandedFilename = displayFilename + ' - SKDL (samkiel.online)'

  const handleDownloadMp4 = () => {
    const url = `/download/${row.id}?type=mp4&title=${encodeURIComponent(row.title)}&poster=${encodeURIComponent(posterUrl || '')}`
    window.location.href = url
  }

  const handleDownloadMkv = () => {
    const url = `/download/${row.id}?type=mkv&title=${encodeURIComponent(row.title)}&poster=${encodeURIComponent(posterUrl || '')}`
    window.location.href = url
  }

  // Build metadata bits
  const metaLine = useMemo(() => {
    const bits: string[] = []
    bits.push(row.type === 'series' ? 'Series' : 'Movie')
    if (row.type === 'series' && row.season && row.episode) {
        bits.push(`S${row.season.toString().padStart(2, '0')}E${row.episode.toString().padStart(2, '0')}`)
    }
    if (row.quality) bits.push(row.quality)
    
    // Add estimated size label
    const sizeStr = formatSize(row.size)
    if (sizeStr) bits.push(sizeStr)
    
    return bits.join(' • ')
  }, [row.type, row.season, row.episode, row.quality, row.size])

  const handleShare = async () => {
    const shareData = {
      title: `${row.title} — SKDL`,
      text: `Watch ${row.title} on SKDL`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast.success('Link copied to clipboard')
      }
    } catch (err) {
      console.error('Error sharing:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-4 md:pt-16 pb-12 md:pb-24 px-4 md:px-6 font-sans">
      <Toaster position="top-center" theme="dark" />
      <div className="w-full max-w-5xl space-y-4 md:space-y-12">
        
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          <div className="space-y-3 md:space-y-6 flex-1 text-left flex flex-col justify-center h-full py-1 md:py-2">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.4em] font-bold">
                    {tagline}
                  </p>
                  <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-white leading-tight">
                    {row.title}
                  </h1>
                  <p className="text-xs md:text-sm font-mono text-zinc-500 uppercase tracking-[0.2em] font-medium pt-2">
                    {metaLine}
                  </p>
                </div>
              </div>
          </div>
        </div>

        {/* Player Container */}
        <div>
          <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-black min-h-[300px] shadow-2xl">
            {isMounted ? (
                <PlayerClient 
                  proxyUrl={proxyUrl} 
                  imdbId={row.imdb_id} 
                  query={displayFilename}
                  poster={posterUrl}
                  onSubtitleFound={(url) => setSubtitleUrl(url)} 
                />
            ) : (
                <div className="w-full aspect-video bg-zinc-950 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-white/80 rounded-full animate-spin"></div>
                </div>
            )}
          </div>

          <div className="flex flex-col items-center space-y-1 sm:space-y-2 md:space-y-6 pt-0 mt-1 sm:mt-0 md:mt-2 pb-6 md:pb-12">
              <div className="w-full max-w-2xl flex flex-col sm:flex-row gap-3 md:gap-4">
                  <button
                      onClick={handleDownloadMp4}
                      className="flex-1 flex justify-center items-center bg-[#121212] border border-white/10 text-white text-xs md:text-sm font-black px-8 py-5 rounded-lg hover:bg-zinc-800 transition-all uppercase tracking-[0.2em] font-mono"
                  >
                      DOWNLOAD MP4
                  </button>

                  <button
                      onClick={handleDownloadMkv}
                      className="flex-1 flex justify-center items-center bg-white text-black text-xs md:text-sm font-black px-8 py-5 rounded-lg hover:bg-zinc-100 transition-all uppercase tracking-[0.2em] font-mono"
                  >
                      DOWNLOAD MKV + SUBS
                  </button>
              </div>

              {subtitleUrl && (
                  <div className="text-center pt-2">
                      <a 
                          href={`/api/proxy?url=${encodeURIComponent(subtitleUrl || '')}&filename=${encodeURIComponent(brandedFilename)}.srt&dl=1`} 
                          className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors underline underline-offset-8 decoration-zinc-800 uppercase tracking-widest"
                      >
                          ↓ Download Subtitles (.srt)
                      </a>
                  </div>
              )}

              <div className="pt-2 flex flex-col items-center gap-6">
                  <a
                      href="https://t.me/SK_DLBOT"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors uppercase tracking-[0.3em] font-bold"
                  >
                      Request Another on Telegram →
                  </a>

                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-mono text-[10px] uppercase tracking-[0.4em] font-black group mt-4 shadow-2xl"
                  >
                    <Share2 className="w-4 h-4 text-[#e8ff47]/40 group-hover:text-[#e8ff47] transition-colors" />
                    <span>Share With Friends</span>
                  </button>
              </div>
          </div>
        </div>

        <div className="w-full opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          <AdBanner adKey="player-bottom" width={728} height={90} />
        </div>
      </div>
    </div>
  )
}
