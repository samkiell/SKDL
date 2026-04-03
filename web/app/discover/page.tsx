import { getSupabaseClient } from '@/lib/supabase'
import DiscoverGrid from './DiscoverGrid'

export const dynamic = 'force-dynamic'

export default async function DiscoverPage() {
  const supabase = getSupabaseClient()
  
  // Need to make sure the database table has created_at
  const { data, error } = await supabase
    .from('media')
    .select('id, title, type, quality, created_at')
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) {
    console.error('Failed to fetch discover list:', error)
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-24 pb-12 px-4 md:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="space-y-3">
          <h1 className="text-5xl md:text-7xl tracking-tighter" style={{ fontFamily: 'var(--font-bebas)' }}>
            DISCOVER
          </h1>
          <p className="font-mono text-zinc-500 text-sm md:text-base">
            RECENTLY SERVED VIA @SK_DLBOT
          </p>
        </div>

        <DiscoverGrid initialData={data || []} />
      </div>
    </main>
  )
}
