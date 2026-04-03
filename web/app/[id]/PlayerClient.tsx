"use client"

import { useEffect, useRef } from 'react'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import '../globals.css' // Assuming the CSS variables are here or it leverages global scope

export default function PlayerClient({ proxyUrl }: { proxyUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoRef.current) return
    const player = new Plyr(videoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'fullscreen'],
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      storage: { enabled: true, key: 'skdl-player' },
    })

    return () => player.destroy()
  }, [])

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
        Your browser does not support HTML5 video playback.
      </video>
    </div>
  )
}
