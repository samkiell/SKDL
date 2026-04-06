import { getSupabaseClient } from '@/lib/supabase'
import DiscoverGrid from './DiscoverGrid'
import AdBanner from '../components/AdBanner'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function DiscoverPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''

  const supabase = getSupabaseClient()
  
  let query = supabase
    .from('media')
    .select('id, title, type, quality, created_at, poster_url')
    .order('created_at', { ascending: false })
    .limit(24)

  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch discover list:', error)
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-8 pb-12 px-4 md:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-3">
                <h1 className="text-5xl md:text-7xl tracking-tighter" style={{ fontFamily: 'var(--font-bebas)' }}>
                    DISCOVER
                </h1>
                <p className="font-mono text-zinc-500 text-sm md:text-base">
                    RECENTLY SERVED VIA @SK_DLBOT
                </p>
            </div>
            <div className="w-full md:w-auto opacity-50 grayscale hover:grayscale-0 transition-all">
                <AdBanner adKey="discover-top" width={300} height={250} />
            </div>
        </div>

        <DiscoverGrid initialData={data || []} />
        
        <div className="pt-12 border-t border-white/5">
            <AdBanner adKey="discover-bottom" width={728} height={90} />
        </div>
      </div>
    </main>
  )
}
