import { notFound } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { getSupabaseClient } from '@/lib/supabase'
import { getFreshCdnUrl } from '@/lib/moviebox'
import { Metadata } from 'next'

// Dynamically import the player component to fix "document is not defined" during SSR
const PlayerPageClient = nextDynamic(() => import('./PlayerPageClient'), { ssr: false })

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

  return <PlayerPageClient row={row} proxyUrl={proxyUrl} />
}
