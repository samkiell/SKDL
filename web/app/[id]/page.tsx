import { redirect, notFound } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { getFreshCdnUrl } from '@/lib/moviebox'

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
}

function ExpiredPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⏳</div>
        <h1 className="text-xl font-semibold text-white mb-2">{title}</h1>
        <p className="text-gray-400 mb-6">Netflix and Chill with SKDL — but this link has expired.</p>
        <a
          href="https://t.me/SK_DLBOT"
          className="inline-block bg-white text-black font-medium px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Request again on Telegram
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
  const supabase = getSupabaseClient()
  
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

  // Redirect through our robust proxy to bypass Referer/origin blocks
  redirect(`/api/proxy?url=${encodeURIComponent(finalUrl)}`)
}
