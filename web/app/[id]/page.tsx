import { notFound } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { getFreshCdnUrl } from '@/lib/moviebox'
import { Metadata } from 'next'
import PlayerClient from './PlayerClient'

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
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  try {
    const supabase = getSupabaseClient()
    const { data } = await supabase
      .from('media')
      .select('*')
      .eq('id', id)
      .single()
      
    if (data) {
      const row = data as MediaRow
      const desc = row.description || `Watch ${row.title} on SKDL via samkiel.online`
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

function getSafeFilename(row: MediaRow): string {
  let name = row.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
  if (row.type === 'series' && row.season && row.episode) {
    name += ` - S${row.season.toString().padStart(2, '0')}E${row.episode.toString().padStart(2, '0')}`
  }
  return name + ' - SKDL(samkiel.online).mp4'
}

function PlayerPage({ row, proxyUrl }: { row: MediaRow; proxyUrl: string }) {
  const safeFilename = getSafeFilename(row)
  
  // Create a specific download URL that instructs the proxy to use attachment disposition
  const downloadUrl = `${proxyUrl}&filename=${encodeURIComponent(safeFilename)}&dl=1`

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

        <PlayerClient proxyUrl={proxyUrl} />

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
          <a
            href={downloadUrl}
            download={safeFilename}
            className="flex-1 flex justify-center items-center bg-white text-black text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-zinc-200 transition-colors uppercase tracking-wider"
          >
            Download File
          </a>
          <a
            href="https://t.me/SK_DLBOT"
            className="flex-1 flex justify-center items-center bg-transparent border border-white/20 text-white text-xs md:text-sm font-bold px-6 py-4 rounded-md hover:bg-white/5 transition-colors uppercase tracking-wider"
          >
            Request Another
          </a>
        </div>

      </div>
    </main>
  )
}
export const dynamic = 'force-dynamic'

export default async function LinkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch (e) {
    console.error('Supabase client init failed:', e)
    notFound()
  }
  
  console.log('--- Redirecting Link:', id)

  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Supabase Error for id:', id, error)
  }
  
  if (!data) {
    console.log('Record not found in DB for id:', id)
    notFound()
  }

  const row = data as MediaRow
  const expiresAt = new Date(row.expires_at)
  const now = new Date()

  if (expiresAt < now) {
    return <ExpiredPage title={row.title} />
  }

  let finalUrl = row.cdn_url

  // If we have a subject_id, get a fresh IP-bound link for the current requester
  if (row.subject_id) {
    try {
      finalUrl = await getFreshCdnUrl(
        row.subject_id,
        row.type,
        row.season || 0,
        row.episode || 0
      )
    } catch (e) {
      console.error('Failed to refresh CDN URL, falling back to original:', e)
    }
  }

  const proxyUrl = `/api/proxy?url=${encodeURIComponent(finalUrl)}`

  return <PlayerPage row={row} proxyUrl={proxyUrl} />
}
