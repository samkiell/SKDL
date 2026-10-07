import { notFound } from 'next/navigation'
import { getRedisClient } from '@/lib/redis'
import { getMovieBoxDetails, searchMovieBox } from '@/lib/moviebox'
import { Metadata } from 'next'
import PlayerPageClient from './PlayerPageClient'

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  try {
    const redis = getRedisClient()
    const data = await redis.get<MediaRow>(`media:${id}`)
      
    if (data) {
      const row = data as MediaRow
      const desc = row.description || `Watch ${row.title} on SKDL via skdlm.vercel.app`
      return {
        title: `${row.title} — SKDL`,
        description: desc,
        openGraph: {
          title: `${row.title} — SKDL`,
          description: desc,
          siteName: 'SKDL',
          images: row.poster_url ? [{ url: row.poster_url }] : [],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${row.title} — SKDL`,
          images: row.poster_url ? [row.poster_url] : [],
        }
      }
    }
  } catch (e) {
    console.error('Metadata generation failed for id:', id, e)
  }

  // Fallback if not found or errored out
  return {
    title: 'SKDL',
    description: 'The AI-powered media delivery platform.',
    openGraph: {
      title: 'SKDL',
      description: 'The AI-powered media delivery platform.',
      siteName: 'SKDL',
    },
    twitter: {
      card: 'summary',
      title: 'SKDL',
    }
  }
}

function ExpiredPage({ 
  title, 
  type = 'movie', 
  season, 
  episode 
}: { 
  title: string
  type?: string
  season?: number | null
  episode?: number | null 
}) {
  const isSeries = type === 'series'
  const displayTitle = isSeries && season && episode 
    ? `${title} S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`
    : title

  const telegramMsg = isSeries && season && episode
    ? `hey, can I get ${title} Season ${season} Episode ${episode}`
    : `hey, can I get ${title}`

  const tgUrl = `https://t.me/SK_DLBOT?text=${encodeURIComponent(telegramMsg)}`

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 md:px-6 font-sans text-white">
      <div className="text-center w-full max-w-md border border-white/10 p-8 rounded-2xl bg-[#080808] shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
        
        <div className="relative z-10 space-y-6">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto transition-transform group-hover:scale-110 duration-500">
            <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-space font-bold tracking-tighter text-white uppercase">Link Expired</h1>
            <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.4em] font-black">Error 410 // Transmission_Expired</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-zinc-300 font-bold max-w-xs mx-auto">
              {displayTitle}
            </p>
            <p className="text-xs text-zinc-500 font-mono leading-relaxed max-w-xs mx-auto">
              This transmission ID has expired. Tap below to request fresh streaming and download links from the bot.
            </p>
          </div>

          <div className="pt-4">
            <a
              href={tgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white text-black text-[11px] font-black px-6 py-4 rounded-xl hover:bg-zinc-200 transition-all uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              Request Again on Telegram
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'

export default async function LinkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let data: MediaRow | null = null
  try {
    const redis = getRedisClient()
    data = await redis.get<MediaRow>(`media:${id}`)
  } catch (e) {
    console.error('Redis lookup failed for id:', id, e)
    notFound()
  }
  
  console.log('--- Redirecting Link:', id)

  if (!data) {
    console.log('Record not found in Redis for id:', id)
    // Check if long-lived metadata exists to show specific expired title
    try {
      const redis = getRedisClient()
      const meta = await redis.get<any>(`media:meta:${id}`)
      if (meta?.title) {
        return <ExpiredPage title={meta.title} type={meta.type} season={meta.season} episode={meta.episode} />
      }

      const recentList = await redis.lrange('media:recent', 0, 100)
      for (const itemStr of recentList) {
        try {
          const parsed = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr
          if (parsed?.id === id && parsed?.title) {
            return <ExpiredPage title={parsed.title} type={parsed.type} season={parsed.season} episode={parsed.episode} />
          }
        } catch {}
      }
    } catch (e) {
      console.error('Fallback lookup failed:', e)
    }

    notFound()
  }

  const row = data as MediaRow
  const expiresAt = new Date(row.expires_at)
  const now = new Date()

  if (expiresAt < now) {
    return <ExpiredPage title={row.title} type={row.type} season={row.season} episode={row.episode} />
  }

  let finalUrl = row.cdn_url
  let finalSize = row.size || 0
  let finalPoster = row.poster_url

  // 1. Resolve MovieBox Details (Downloads and Captions)
  if (row.subject_id) {
    try {
      const details = await getMovieBoxDetails(
        row.subject_id,
        row.type,
        row.season || 0,
        row.episode || 0
      )
      
      const downloads = details.downloads || []
      if (downloads.length > 0) {
        // Match the specific requested resolution (e.g. 480p, 720p, 1080p)
        const requestedRes = parseInt((row.quality || '').replace(/\D/g, ''), 10) || 0
        const matched = requestedRes > 0 
          ? downloads.find(d => Number(d.resolution) === requestedRes)
          : null

        if (matched) {
          if (matched.url) finalUrl = matched.url
          if (matched.size) finalSize = matched.size
        } else if (row.cdn_url && row.size) {
          // Retain stored quality-specific URL and size if no exact match in refreshed list
          finalUrl = row.cdn_url
          finalSize = row.size
        } else {
          const sorted = [...downloads].sort((a, b) => (b.resolution || 0) - (a.resolution || 0))
          if (sorted[0]?.url) finalUrl = sorted[0].url
          if (sorted[0]?.size) finalSize = sorted[0].size
        }
        console.log('Refreshed CDN URL via MovieBox Detail')
      }
    } catch (e) {
      console.error('Failed to refresh CDN URL via MovieBox Detail:', e)
    }
  }

  // Ensure stored fallbacks are retained if refresh didn't provide new values
  if (!finalUrl && row.cdn_url) {
    finalUrl = row.cdn_url
  }
  if (!finalSize && row.size) {
    finalSize = row.size
  }

  // 2. Poster Resolution - Strictly MovieBox-first
  if (!finalPoster && row.title) {
    try {
      const searchRes = await searchMovieBox(row.title, row.type)
      if (searchRes?.cover?.url) {
        finalPoster = searchRes.cover.url
        console.log('Found MovieBox Poster via search:', finalPoster)
      }
    } catch (e) {
      console.error('Failed to search MovieBox poster:', e)
    }
  }

  // Final fallback poster if MovieBox has absolutely nothing
  const fallbackPoster = 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?q=80&w=1000&auto=format&fit=crop'
  if (!finalPoster) {
      finalPoster = fallbackPoster
  }

  const isEmbedUrl = Boolean(finalUrl && (finalUrl.includes('embed') || finalUrl.includes('autoembed') || finalUrl.includes('2embed') || finalUrl.includes('vidsrc')))
  const proxyUrl = isEmbedUrl ? finalUrl : `/api/proxy?url=${encodeURIComponent(finalUrl)}`
  
  // Pass metadata to the client
  const rowForClient = {
      ...row,
      cdn_url: finalUrl,
      poster_url: finalPoster,
      size: Number(finalSize) || Number(row.size) || 0
  }

  return <PlayerPageClient row={rowForClient as any} proxyUrl={proxyUrl} />
}
