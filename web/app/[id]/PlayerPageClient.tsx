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
  const [isMuxing, setIsMuxing] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(10)

  const statuses = [
    "Preparing MKV...",
    "Stitching Bits...",
    "Muxing Streams...",
    "Syncing Captions...",
    "Polishing File...",
    "Almost Ready..."
  ]

  useEffect(() => {
    if (timeLeft > 0) {
        const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
        return () => clearTimeout(timer)
    }
  }, [timeLeft])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isMuxing) {
        interval = setInterval(() => {
            setStatusIndex((prev) => Math.min(prev + 1, statuses.length - 1))
        }, 2000)
    } else {
        setStatusIndex(0)
    }
    return () => clearInterval(interval)
  }, [isMuxing])

  const safeFilename = row.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
  const displayFilename = row.type === 'series' 
    ? `${safeFilename} S${row.season?.toString().padStart(2, '0')}E${row.episode?.toString().padStart(2, '0')}`
    : safeFilename

  const downloadMp4Url = `${proxyUrl}&filename=${encodeURIComponent(displayFilename + '.mp4')}&dl=1`

  const handleDownloadMkv = async () => {
    if (!subtitleUrl) return
    
    setIsMuxing(true)
    try {
      const res = await fetch('/api/mux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: row.cdn_url,
          subtitleUrl: subtitleUrl,
          filename: displayFilename
        })
      })

      if (!res.ok) throw new Error('Muxing failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${displayFilename}.mkv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('MKV Download error:', err)
      alert('Failed to prepare MKV. Try downloading MP4 instead.')
    } finally {
      setIsMuxing(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-4 md:pt-12 pb-12 px-4 selection:bg-white/20 font-sans">
      <div className="w-full max-w-5xl space-y-5 md:space-y-8">
        
        <div className="space-y-1.5 md:space-y-2 text-center md:text-left">
          <p className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-widest">
            SKDL_STREAM // PRIVATE
          </p>
          <h1 className="text-xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
            {row.title}
          </h1>
          <p className="text-[10px] md:text-sm text-zinc-400 font-mono">
            {mediaMetaLine(row)}
          </p>
        </div>

        <PlayerClient 
          proxyUrl={proxyUrl} 
          imdbId={row.imdb_id} 
          query={displayFilename}
          onSubtitleFound={(url) => setSubtitleUrl(url)} 
        />

        <AdBanner />

        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                {/* Download MP4 */}
                <a
                    href={timeLeft === 0 ? downloadMp4Url : "#"}
                    onClick={(e) => { if (timeLeft > 0) e.preventDefault(); }}
                    className={`flex-1 flex justify-center items-center bg-zinc-900 border border-white/10 text-white text-xs md:text-sm font-bold px-6 py-4 rounded-md transition-all uppercase tracking-wider ${timeLeft > 0 ? 'opacity-50 cursor-not-allowed hover:bg-zinc-900' : 'hover:bg-zinc-800'}`}
                >
                    {timeLeft > 0 ? `Download MP4 (${timeLeft}s)` : 'Download MP4'}
                </a>

                {/* Download MKV + Subs */}
                <button
                    onClick={handleDownloadMkv}
                    disabled={!subtitleUrl || isMuxing || timeLeft > 0}
                    title={!subtitleUrl ? "No subtitles found for this title" : ""}
                    className="flex-1 flex justify-center items-center bg-white text-black text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-zinc-200 transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isMuxing 
                        ? statuses[statusIndex] 
                        : (timeLeft > 0 ? `Download MKV (${timeLeft}s)` : "Download MKV + Subs")
                    }
                </button>
            </div>

            {subtitleUrl && (
                <div className="text-center">
                    <a 
                        href={`/api/proxy?url=${encodeURIComponent(subtitleUrl)}&filename=${encodeURIComponent(displayFilename)}.srt&dl=1`} 
                        className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-4 decoration-zinc-800"
                    >
                        ↓ Download Subtitles (.srt)
                    </a>
                </div>
            )}
        </div>

        <div className="flex justify-center pt-8">
          <a
            href="https://t.me/SK_DLBOT"
            className="flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
          >
            Request Another on Telegram →
          </a>
        </div>

      </div>
    </main>
  )
}
