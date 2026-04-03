"use client"

import { useEffect, useRef, useState } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import '../globals.css'

interface PlayerClientProps {
  proxyUrl: string
  imdbId?: string
  query?: string
  onSubtitleFound?: (url: string) => void
}

export default function PlayerClient({ proxyUrl, imdbId, query, onSubtitleFound }: PlayerClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchSubtitles = async () => {
      try {
        const url = new URL('/api/subtitles', window.location.origin)
        if (imdbId) url.searchParams.set('imdb_id', imdbId)
        if (query) url.searchParams.set('query', query)
        
        const res = await fetch(url.toString())
        const data = await res.json()
        if (data.found && data.subtitleUrl) {
          setSubtitleUrl(data.subtitleUrl)
          if (onSubtitleFound) onSubtitleFound(data.subtitleUrl)
        }
      } catch (err) {
        console.error('Failed to fetch subtitles:', err)
      }
    }

    fetchSubtitles()
  }, [imdbId, query, onSubtitleFound])

  useEffect(() => {
    if (!videoRef.current) return
    const player = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'fullscreen'],
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      storage: { enabled: true, key: 'skdl-player' },
      captions: { active: true, update: true, language: 'en' }
    })

    return () => player.destroy()
  }, [subtitleUrl]) // Re-init when subtitle is added to ensure track is picked up

  return (
    <div className="relative w-full overflow-hidden rounded-xl outline outline-1 outline-white/10 shadow-2xl bg-black">
      <video
        ref={videoRef}
        controls
        preload="metadata"
        playsInline
        className="w-full h-auto aspect-video outline-none"
        src={proxyUrl}
      >
        {subtitleUrl && (
          <track
            kind="captions"
            label="English"
            srcLang="en"
            src={subtitleUrl}
            default
          />
        )}
        Your browser does not support HTML5 video playback.
      </video>
    </div>
  )
}
