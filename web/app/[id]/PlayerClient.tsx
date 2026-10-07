"use client"

import { useEffect, useRef, useState, useMemo } from 'react'

interface PlayerClientProps {
  proxyUrl: string
  imdbId?: string
  query?: string
  poster?: string
  mediaType?: 'movie' | 'series'
  season?: number | null
  episode?: number | null
  onSubtitleFound?: (url: string) => void
}

export default function PlayerClient({ 
  proxyUrl, 
  imdbId, 
  query, 
  poster, 
  mediaType,
  season,
  episode,
  onSubtitleFound 
}: PlayerClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null)
  const [isCaptionsOn, setIsCaptionsOn] = useState(true)
  const controlsTimeout = useRef<any>(null)

  // Subtitle resolution logic
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
        console.error('Subtitle fetch failed:', err)
      }
    }
    fetchSubtitles()
  }, [imdbId, query, onSubtitleFound])

  // Playback handlers
  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) videoRef.current.pause()
    else videoRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const toggleCaptions = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!videoRef.current) return
    const tracks = videoRef.current.textTracks
    if (tracks && tracks.length > 0) {
        const nextState = !isCaptionsOn
        tracks[0].mode = nextState ? 'showing' : 'hidden'
        setIsCaptionsOn(nextState)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (time: number) => {
    const h = Math.floor(time / 3600)
    const m = Math.floor((time % 3600) / 60)
    const s = Math.floor(time % 60)
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current)
    controlsTimeout.current = setTimeout(() => setShowControls(false), 3000)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!videoRef.current) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 2) {
        videoRef.current.currentTime -= 10
    } else {
        videoRef.current.currentTime += 10
    }
  }

  const toggleFullscreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!videoRef.current || !videoRef.current.parentElement) return

    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen()
        } else {
            await videoRef.current.parentElement.requestFullscreen()
            if (screen.orientation && (screen.orientation as any).lock) {
                await (screen.orientation as any).lock('landscape').catch(() => {})
            }
        }
    } catch (err) {
        console.error('Fullscreen/Orientation error:', err)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock()
            }
        }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        if (e.code === 'ArrowRight') { if (videoRef.current) videoRef.current.currentTime += 10; }
        if (e.code === 'ArrowLeft') { if (videoRef.current) videoRef.current.currentTime -= 10; }
        if (e.code === 'KeyC') { if (videoRef.current) toggleCaptions(e as any); }
        if (e.code === 'KeyF') { toggleFullscreen(); }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, isCaptionsOn])

  const isEmbed = proxyUrl.includes('embed') || proxyUrl.includes('autoembed') || proxyUrl.includes('2embed') || proxyUrl.includes('vidsrc')
  const effectiveImdb = imdbId || proxyUrl.match(/(tt\d+)/)?.[1]
  const [activeServerIndex, setActiveServerIndex] = useState(0)

  const serverList = useMemo(() => {
    if (!effectiveImdb) {
      const sanitized = proxyUrl.includes('player.autoembed.cc')
        ? proxyUrl.replace('player.autoembed.cc', 'autoembed.co')
        : proxyUrl
      return [{ name: 'Server 1', url: sanitized }]
    }

    const isSeries = mediaType === 'series' && Boolean(season && episode)
    return [
      {
        name: 'VidSrc',
        url: isSeries
          ? `https://vidsrc.me/embed/tv?imdb=${effectiveImdb}&season=${season}&episode=${episode}`
          : `https://vidsrc.me/embed/movie?imdb=${effectiveImdb}`
      },
      {
        name: 'AutoEmbed',
        url: isSeries
          ? `https://autoembed.co/tv/imdb/${effectiveImdb}-${season}-${episode}`
          : `https://autoembed.co/movie/imdb/${effectiveImdb}`
      },
      {
        name: '2Embed',
        url: isSeries
          ? `https://www.2embed.cc/embedtv/${effectiveImdb}&s=${season}&e=${episode}`
          : `https://www.2embed.cc/embed/${effectiveImdb}`
      },
      {
        name: 'VidSrc.to',
        url: isSeries
          ? `https://vidsrc.to/embed/tv/${effectiveImdb}/${season}/${episode}`
          : `https://vidsrc.to/embed/movie/${effectiveImdb}`
      }
    ]
  }, [effectiveImdb, mediaType, season, episode, proxyUrl])

  const currentEmbedUrl = serverList[activeServerIndex]?.url || serverList[0]?.url || proxyUrl

  if (isEmbed) {
    return (
      <div className="space-y-3">
        {serverList.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 font-bold">SOURCE SERVER:</span>
              <div className="flex items-center gap-1.5 bg-[#121212] p-1 rounded-lg border border-white/10">
                {serverList.map((srv, idx) => (
                  <button
                    key={srv.name}
                    type="button"
                    onClick={() => setActiveServerIndex(idx)}
                    className={`px-2.5 py-1 text-[11px] font-mono uppercase rounded transition-all ${
                      activeServerIndex === idx
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {srv.name}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">Switch server if stream fails</span>
          </div>
        )}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          <iframe
            key={currentEmbedUrl}
            title="Video Player"
            src={currentEmbedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </div>
    )
  }

  return (
    <div 
        className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group cursor-pointer"
        onMouseMove={handleMouseMove}
        onClick={(e) => { if (e.detail === 1) togglePlay(); }}
        onDoubleClick={handleDoubleClick}
    >
      <video
        ref={videoRef}
        src={proxyUrl}
        poster={poster}
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
      >
        {subtitleUrl && (
          <track
            key={subtitleUrl}
            kind="subtitles"
            src={`/api/proxy?url=${encodeURIComponent(subtitleUrl || '')}`}
            srcLang="en"
            label="English"
            default
          />
        )}
        Your browser does not support HTML5 video playback.
      </video>

      {/* Persistent Watermark SKDL */}
      <div className="absolute bottom-16 right-6 pointer-events-none z-10 select-none">
        <span className="text-white/20 font-mono text-sm tracking-[0.3em] font-bold">
            SKDL
        </span>
      </div>

      {/* Play Overlay (Big button in middle) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none transition-opacity">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                <svg className="w-8 h-8 text-white fill-current translate-x-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </div>
        </div>
      )}

      {/* Custom Controls Container */}
      <div className={`absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Progress Bar (Scrubber) */}
        <div className="w-full px-2 mb-2">
            <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleScrub}
                className="w-full h-1 bg-white/20 appearance-none cursor-pointer rounded-full accent-white hover:h-1.5 transition-all"
            />
        </div>

        {/* Bottom Bar: Time, Buttons, etc. */}
        <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
                <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    className="text-white hover:scale-110 transition-transform"
                >
                    {isPlaying ? (
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>
                
                <div className="text-[11px] md:text-sm font-mono font-bold tracking-tight">
                    <span className="text-zinc-400">{formatTime(currentTime)}</span>
                    <span className="text-white/40 mx-1">/</span>
                    <span className="text-white/80">{formatTime(duration)}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* CC Toggle */}
                {subtitleUrl && (
                    <button 
                        onClick={toggleCaptions}
                        className={`text-xs font-bold px-2 py-1 rounded transition-colors ${isCaptionsOn ? 'bg-zinc-400 text-black' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
                    >
                        CC
                    </button>
                )}

                <button 
                    onClick={toggleFullscreen}
                    className="text-white/70 hover:text-white"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M7 14H5v5l5-5-5-5v5zM19 5h-5v2h5v5l2-2V5zM14 19h5v-5l2 2v5h-5zM5 10V5h5L8 7l-3-3v5z"/></svg>
                </button>
            </div>
        </div>
      </div>
    </div>
  )
}
