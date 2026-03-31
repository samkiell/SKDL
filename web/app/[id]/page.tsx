import { redirect, notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface MediaRow {
  id: string
  title: string
  cdn_url: string
  type: 'movie' | 'series'
  quality: string
  season: number | null
  episode: number | null
  expires_at: string
}

function ExpiredPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⏳</div>
        <h1 className="text-xl font-semibold text-white mb-2">{title}</h1>
        <p className="text-gray-400 mb-6">This download link has expired.</p>
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

export default async function LinkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const row = data as MediaRow
  const expiresAt = new Date(row.expires_at)
  const now = new Date()

  if (expiresAt < now) {
    return <ExpiredPage title={row.title} />
  }

  redirect(row.cdn_url)
}
