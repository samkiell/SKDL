'use client'

import { useState } from 'react'
import Link from 'next/link'
import PlayerClient from './PlayerClient'
import AdBanner from '../components/AdBanner'

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
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-8 pb-12 px-4 selection:bg-white/20 font-sans">
      <div className="w-full max-w-5xl space-y-6 md:space-y-8">
        
        <div className="space-y-1.5 md:space-y-2">
          <p className="text-[10px] md:text-xs font-mono text-zinc-500 uppercase tracking-widest">
            SKDL_STREAM // PRIVATE
          </p>
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
            {row.title}
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 font-mono pt-1">
            {mediaMetaLine(row)}
          </p>
        </div>

        <PlayerClient 
          proxyUrl={proxyUrl} 
          imdbId={row.imdb_id} 
          query={row.title}
          onSubtitleFound={(url) => setSubtitleUrl(url)} 
        />

        <AdBanner />

        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
                {/* Download MP4 */}
                <a
                    href={downloadMp4Url}
                    className="flex-1 flex justify-center items-center bg-zinc-900 border border-white/10 text-white text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-zinc-800 transition-colors uppercase tracking-wider"
                >
                    Download MP4
                </a>

                {/* Download MKV + Subs */}
                <button
                    onClick={handleDownloadMkv}
                    disabled={!subtitleUrl || isMuxing}
                    title={!subtitleUrl ? "No subtitles found for this title" : ""}
                    className="flex-1 flex justify-center items-center bg-white text-black text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-zinc-200 transition-colors uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isMuxing ? "Preparing MKV..." : "Download MKV + Subs"}
                </button>
            </div>

            {subtitleUrl && (
                <div className="text-center">
                    <a 
                        href={subtitleUrl} 
                        download={`${displayFilename}.srt`}
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
