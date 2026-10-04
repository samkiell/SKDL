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

function ExpiredPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 md:px-6 font-sans text-white">
      <div className="text-center w-full max-w-md border border-white/10 p-8 rounded-xl bg-[#0a0a0a]">
        <div className="text-3xl mb-4 text-zinc-500">⏳</div>
        <h1 className="text-xl font-medium mb-2">{title}</h1>
        <p className="text-sm text-zinc-400 mb-8 font-mono">LINK_EXPIRED_OR_INVALID</p>
        <a
          href={`https://t.me/SK_DLBOT?text=${encodeURIComponent(`hey i would like to download ${title}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-white text-black text-sm font-bold px-6 py-3.5 rounded-md hover:bg-zinc-200 transition-colors uppercase tracking-wider"
        >
          Request Again on Telegram
        </a>
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
    notFound()
  }

  const row = data as MediaRow
  const expiresAt = new Date(row.expires_at)
  const now = new Date()

  if (expiresAt < now) {
    return <ExpiredPage title={row.title} />
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
        // Pick highest resolution available
        const sorted = downloads.sort((a, b) => (b.resolution || 0) - (a.resolution || 0))
        finalUrl = sorted[0].url
        finalSize = sorted[0].size || 0
        console.log('Refreshed CDN URL via MovieBox Detail')
      }
    } catch (e) {
      console.error('Failed to refresh CDN URL via MovieBox Detail:', e)
    }
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

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}`
  
  // Pass metadata to the client
  const rowForClient = {
      ...row,
      cdn_url: finalUrl,
      poster_url: finalPoster,
      size: Number(finalSize) || Number(row.size) || 0
  }

  return <PlayerPageClient row={rowForClient as any} proxyUrl={proxyUrl} />
}
