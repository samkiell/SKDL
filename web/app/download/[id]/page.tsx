'use client'

import { useState, useEffect, use, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AdBanner from '../../components/AdBanner'
import Link from 'next/link'
import { ArrowLeft, Clock, ShieldCheck, Download, AlertCircle, Loader2 } from 'lucide-react'

export default function DownloadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  
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
    "Preparing MKV streams...",
    "Stitching video bits...",
    "Muxing audio & subs...",
    "Syncing tracks...",
    "Polishing final file...",
    "Finalizing download..."
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
        setStatusIndex((prev) => (prev + 1) % statuses.length)
      }, 2500)
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
         data = { title: title, url: externalUrl, type: 'srt' }
      } else {
        const res = await fetch(`/api/media/${id}`)
        data = await res.json()
        if (data.error) throw new Error(data.error)
      }

      const safeFilename = data.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
      const displayFilename = data.type === 'series' 
        ? `${safeFilename} S${data.season?.toString().padStart(2, '0')}E${data.episode?.toString().padStart(2, '0')}`
        : safeFilename
      const brandedFilename = displayFilename + ' - SKDL (samkiel.online)'

      if (data.type === 'srt' || type === 'srt') {
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
    } catch (err: any) {
      console.error('Download fetch error:', err)
      setError(err.message || 'Failed to generate link. Try again.')
      setLoading(false)
    }
  }

  // Progress Circle Math
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (counter / 10) * circumference;

  return (
    <main className="min-h-screen bg-black text-white font-sans selection:bg-[#e8ff47]/30 flex flex-col items-center">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20 z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#e8ff47] blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-800 blur-[150px]"></div>
      </div>

      <div className="w-full max-w-2xl px-6 py-12 md:py-20 space-y-12">
        {/* Navigation */}
        <div className="flex justify-between items-center">
            <Link href={`/${id}`} className="group flex items-center gap-2 text-[10px] font-mono text-zinc-500 hover:text-white transition-all uppercase tracking-widest">
                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                <span>Return to Player</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <ShieldCheck className="w-3 h-3 text-[#e8ff47]" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Encrypted Direct Link</span>
            </div>
        </div>

        {/* Content Card */}
        <div className="relative group">
            <div className="absolute inset-0 bg-white/5 blur-2xl rounded-[2rem] group-hover:bg-[#e8ff47]/5 transition-colors"></div>
            <div className="relative bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 md:p-12 space-y-10 flex flex-col items-center text-center">
                
                {/* Header Info */}
                <div className="space-y-4">
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-mono text-[#e8ff47] uppercase tracking-[0.4em] font-bold">
                            NODE_SYNC_STATUS
                        </span>
                        <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase italic">
                            {type === 'mkv' ? 'MKV + SUBTITLES' : 'MP4 DOWNLOAD'}
                        </h1>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        {poster && (
                            <div className="w-24 h-36 rounded-xl overflow-hidden shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] border border-white/10 ring-4 ring-white/5">
                                <img src={poster} alt={title} className="w-full h-full object-cover" />
                            </div>
                        )}
                        <p className="text-sm md:text-base text-zinc-400 max-w-xs leading-relaxed">
                            Generating a secure {type.toUpperCase()} link for <br/>
                            <span className="text-white font-bold inline-block mt-1">{title}</span>
                        </p>
                    </div>
                </div>

                {/* Progress Visualizer */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                        {/* Background Circle */}
                        <circle
                            cx="80"
                            cy="80"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            className="text-white/5"
                        />
                        {/* Progress Circle */}
                        <circle
                            cx="80"
                            cy="80"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="text-[#e8ff47] transition-all duration-1000 linear shadow-[0_0_10px_#e8ff47]"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-space font-bold text-white tabular-nums">
                            {counter > 0 ? counter : <Download className="w-8 h-8 animate-bounce" />}
                        </span>
                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                            {counter > 0 ? 'Seconds' : 'Ready'}
                        </span>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="min-h-[20px]">
                    {counter > 0 ? (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                            <Clock className="w-3 h-3 animate-pulse" />
                            <span>Verifying security nodes...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#e8ff47] uppercase tracking-widest">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Secure link verified</span>
                        </div>
                    )}
                </div>

                {/* Download Button */}
                <div className="w-full space-y-6">
                    <button
                        onClick={handleGetLink}
                        disabled={counter > 0 || loading || isMuxing}
                        className={`group relative w-full overflow-hidden text-sm font-black px-8 py-6 rounded-2xl transition-all uppercase tracking-widest ${
                            counter > 0 
                            ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed border border-white/5' 
                            : 'bg-white text-black hover:bg-[#e8ff47] active:scale-95 shadow-[0_20px_40px_-5px_rgba(255,255,255,0.1)]'
                        }`}
                    >
                        <div className="relative z-10 flex items-center justify-center gap-3">
                            {isMuxing || loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{isMuxing ? statuses[statusIndex] : 'GENERATING...'}</span>
                                </>
                            ) : (
                                <span>{counter > 0 ? `Wait ${counter}s` : 'Initialize Download'}</span>
                            )}
                        </div>
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>

                    {error && (
                        <div className="flex items-center justify-center gap-2 p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <p className="text-red-500 text-[10px] font-mono uppercase tracking-widest">
                                {error}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Ad Placement - Dynamic & Integrated */}
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/5"></div>
                <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Sponsored Content</span>
                <div className="h-px flex-1 bg-white/5"></div>
            </div>
            
            <div className="w-full flex flex-col items-center gap-6">
                <div className="w-full bg-zinc-950/30 backdrop-blur rounded-[1.5rem] border border-white/5 p-4 flex justify-center">
                    <AdBanner adKey="download-top" width={728} height={90} />
                </div>
                
                <div className="bg-zinc-950/30 backdrop-blur rounded-[1.5rem] border border-white/5 p-4 inline-block mx-auto">
                    <AdBanner adKey="download-middle" width={300} height={250} />
                </div>
            </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-center space-y-4 opacity-30">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">
                SKDL // Media Delivery Protocol v2.4a
            </p>
        </div>
      </div>
    </main>
  )
}
