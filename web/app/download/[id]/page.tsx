'use client'

import { useState, useEffect, use, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import AdBanner from '../../components/AdBanner'
import Link from 'next/link'

export default function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  
  const title = searchParams.get('title') || 'Media'
  const poster = searchParams.get('poster') || ''
  const type = searchParams.get('type') || 'mp4'

  const adsOn = process.env.NEXT_PUBLIC_ADS === 'ON'
  const [counter, setCounter] = useState(adsOn ? 10 : 0)
  const [loading, setLoading] = useState(false)
  const [isMuxing, setIsMuxing] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const statuses = [
    "Preparing MKV...",
    "Stitching Bits...",
    "Muxing Streams...",
    "Syncing Captions...",
    "Polishing File...",
    "Almost Ready..."
  ]

  useEffect(() => {
    if (counter > 0) {
      const timer = setTimeout(() => setCounter(counter - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [counter])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isMuxing) {
      interval = setInterval(() => {
        setStatusIndex((prev) => Math.min(prev + 1, statuses.length - 1))
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [isMuxing])

  const handleGetLink = async () => {
    setLoading(true)
    setError(null)
    try {
      let data;
      const externalUrl = searchParams.get('url');

      if (id === 'srt' && type === 'srt' && externalUrl) {
         // Direct subtitle routing bypass
         data = {
            title: title,
            url: externalUrl,
            type: 'srt'
         }
      } else {
        const res = await fetch(`/api/media/${id}`)
        data = await res.json()
        
        if (data.error) {
          setError(data.error)
          setLoading(false)
          return
        }
      }

      const safeFilename = data.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
      const displayFilename = data.type === 'series' 
        ? `${safeFilename} S${data.season?.toString().padStart(2, '0')}E${data.episode?.toString().padStart(2, '0')}`
        : safeFilename
      const brandedFilename = displayFilename + ' - SKDL (samkiel.online)'

      if (data.type === 'srt') {
         const downloadName = `${brandedFilename}.srt`
         const proxyUrl = `/api/proxy?url=${encodeURIComponent(data.url)}&filename=${encodeURIComponent(downloadName)}&dl=1`
         window.location.href = proxyUrl
         setLoading(false)
         return
      }

      if (type === 'mkv') {
        setIsMuxing(true)
        try {
            const subRes = await fetch(`/api/subtitles?query=${encodeURIComponent(displayFilename)}&imdb_id=${data.imdb_id || ''}`)
            const subData = await subRes.json()
            
            const muxRes = await fetch('/api/mux', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoUrl: data.url,
                    subtitleUrl: subData.subtitleUrl || 'not_found',
                    filename: displayFilename,
                    imdbId: data.imdb_id
                })
            })

            if (!muxRes.ok) throw new Error('Muxing failed')

            const blob = await muxRes.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${brandedFilename}.mkv`
            document.body.appendChild(a)
            a.click()
            a.remove()
        } catch (err) {
            console.error('MKV Muxing failed:', err)
            setError('Failed to mux MKV. Please try MP4 instead.')
        } finally {
            setIsMuxing(false)
            setLoading(false)
        }
        return
      }

      const downloadName = `${brandedFilename}.mp4`
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(data.url)}&filename=${encodeURIComponent(downloadName)}&dl=1`
      window.location.href = proxyUrl
      setLoading(false)
    } catch (err) {
      console.error('Download fetch error:', err)
      setError('Failed to generate link. Try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center pt-4 pb-12 px-4 font-sans selection:bg-[#e8ff47]/20">
      <div className="w-full max-w-2xl space-y-4 flex flex-col items-center">
        
        {/* Header / Info */}
        <div className="text-center space-y-1">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.3em] font-medium">
              SKDL_RATE_LIMIT_SYSTEM
            </span>
            <h1 className="text-2xl md:text-4xl font-space font-bold tracking-tighter text-white uppercase">
              {type === 'mkv' ? 'MKV + SUBS Ready' : 'Download MP4'}
            </h1>
          </div>
          
          {poster && (
            <div className="w-20 h-30 md:w-24 md:h-36 mx-auto rounded-lg overflow-hidden border border-white/5 shadow-2xl relative group">
              <img src={poster} alt={title} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
            </div>
          )}
          
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-400 max-w-md mx-auto leading-relaxed">
              You are about to download <span className="text-white font-bold">{title}</span>. 
              {adsOn && ' Please wait for your secure link to be generated.'}
            </p>
          </div>
        </div>

        {/* Ad Placement - Top */}
        <div className="w-full border border-white/5 bg-[#0a0a0a] rounded-xl overflow-hidden p-4">
            <AdBanner adKey="download-top" width={728} height={90} />
        </div>

        {/* Action / Countdown Center */}
        <div className="w-full max-w-sm space-y-8 flex flex-col items-center">
            {/* Syncing / Ring Section */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  className="text-white/5"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray="364.4"
                  strokeDashoffset={276.46 * (counter / 10)}
                  className="text-zinc-400 transition-all duration-1000 linear"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-3xl font-space font-bold text-white tabular-nums">
                {counter > 0 ? counter : '✓'}
              </span>
            </div>

            <div className="text-center space-y-1">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    {counter > 0 ? 'Syncing Server Nodes...' : 'Secure Link Ready'}
                </p>
            </div>

            {/* In-Flow Ad Slot */}
            <div className="w-full min-h-[250px] flex justify-center">
              <AdBanner adKey="download-middle" width={300} height={250} />
            </div>

            <button
              onClick={handleGetLink}
              disabled={counter > 0 || loading || isMuxing}
              className={`group relative w-full overflow-hidden text-sm font-black px-8 py-6 rounded-xl transition-all uppercase tracking-widest ${
                counter > 0 
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' 
                  : 'bg-zinc-400 text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(161,161,170,0.2)]'
              }`}
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {isMuxing ? (
                    <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{statuses[statusIndex]}</span>
                    </>
                ) : (
                    <span>{loading ? 'GENERATING LINK...' : counter > 0 ? `Please Wait (${counter}s)` : 'DOWNLOAD NOW'}</span>
                )}
              </div>
            </button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-[10px] font-mono text-center uppercase tracking-widest">
                    SYSTEM_ERROR: {error}
                </p>
            </div>
          )}

          <Link
            href={`/${id}`}
            className="group block text-center space-y-1"
          >
            <span className="text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors uppercase tracking-[0.2em]">Change your mind?</span>
            <p className="text-[10px] font-mono text-zinc-400 group-hover:text-white transition-colors uppercase tracking-widest">
              ← Return to Player
            </p>
          </Link>
        </div>

        {/* Ad Placement - Bottom */}
        <div className="w-full flex justify-center">
            <div className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest mb-4">Sponsored Advertisement</div>
        </div>

      </div>
    </main>
  )
}
