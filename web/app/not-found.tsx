'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Link2, FileQuestion, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const pathname = usePathname()
  const [mediaInfo, setMediaInfo] = useState<{
    found: boolean
    title?: string
    type?: string
    season?: number | null
    episode?: number | null
  } | null>(null)
  
  // Check if it looks like a media link nanoid (e.g., /hvqhmfqt)
  // Nanoids are 8 chars. Path starts with / and is 9 chars total.
  const isMediaLink = pathname?.length === 9 && !pathname.includes('/', 1)

  useEffect(() => {
    if (isMediaLink && pathname) {
      const id = pathname.replace('/', '')
      fetch(`/api/media-lookup?id=${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.found && data?.title) {
            setMediaInfo(data)
          }
        })
        .catch(() => {})
    }
  }, [isMediaLink, pathname])

  if (isMediaLink) {
    const isSeries = mediaInfo?.type === 'series'
    const displayTitle = mediaInfo?.found && mediaInfo?.title
      ? (isSeries && mediaInfo.season && mediaInfo.episode
          ? `${mediaInfo.title} S${mediaInfo.season.toString().padStart(2, '0')}E${mediaInfo.episode.toString().padStart(2, '0')}`
          : mediaInfo.title)
      : null

    const telegramMsg = mediaInfo?.found && mediaInfo?.title
      ? (isSeries && mediaInfo.season && mediaInfo.episode
          ? `hey, can I get ${mediaInfo.title} Season ${mediaInfo.season} Episode ${mediaInfo.episode}`
          : `hey, can I get ${mediaInfo.title}`)
      : null

    const tgUrl = telegramMsg
      ? `https://t.me/SK_DLBOT?text=${encodeURIComponent(telegramMsg)}`
      : 'https://t.me/SK_DLBOT'

    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 md:px-6 font-sans text-white">
        <div className="text-center w-full max-w-md border border-white/10 p-8 rounded-2xl bg-[#080808] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative z-10 space-y-6">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110 duration-500">
              <Link2 className="w-8 h-8 text-zinc-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-space font-bold tracking-tighter text-white uppercase">
                {mediaInfo?.found ? 'Link Expired' : 'Link Unavailable'}
              </h1>
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-black">
                {mediaInfo?.found ? 'Error 410 // Transmission_Expired' : 'Error 404 // Link_Not_Found'}
              </p>
            </div>

            {displayTitle ? (
              <div className="space-y-1">
                <p className="text-sm text-zinc-300 font-bold max-w-xs mx-auto">
                  {displayTitle}
                </p>
                <p className="text-xs text-zinc-500 font-mono leading-relaxed max-w-xs mx-auto">
                  This transmission ID has expired. Tap below to request fresh streaming and download links from the bot.
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 font-mono leading-relaxed max-w-xs mx-auto opacity-60">
                This transmission ID has either expired or was never registered on the SKDL network.
              </p>
            )}

            <div className="pt-4">
              <a
                href={tgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-white text-black text-[11px] font-black px-6 py-4 rounded-xl hover:bg-zinc-200 transition-all uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                {mediaInfo?.found ? 'Request Again on Telegram' : 'Return to Telegram Bot'}
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Generic 404 for pages/admin/typos
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 md:px-6 font-sans text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-zinc-900 blur-[150px]" />
      </div>
      
      <div className="relative text-center space-y-12 max-w-lg">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-4">
            <FileQuestion className="w-3 h-3 text-zinc-500" />
            <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest leading-none">System Error 404</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-space font-bold tracking-tighter text-white uppercase leading-[0.8]">
            Unknown <br/> Segment<span className="text-zinc-800">.</span>
          </h1>
          <p className="text-zinc-500 font-mono text-[11px] uppercase tracking-[0.4em] font-bold mt-6">
            Requested URL is outside authorized sectors
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-10">
          <Link 
            href="/" 
            className="group flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:bg-zinc-200"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Main Deck
          </Link>
          <button 
            onClick={() => window.history.back()}
            className="px-8 py-4 bg-zinc-900 border border-white/5 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:bg-zinc-800"
          >
            Previous Sector
          </button>
        </div>

        <div className="pt-12 text-[9px] font-mono text-zinc-800 uppercase tracking-[0.5em]">
          SKDL // Core Protocol Failure
        </div>
      </div>
    </div>
  )
}
