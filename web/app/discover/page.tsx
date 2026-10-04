import { getRedisClient } from '@/lib/redis'
import DiscoverGrid from './DiscoverGrid'
import AdBanner from '../components/AdBanner'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function DiscoverPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page) : 1
  const PAGE_SIZE = 24

  const redis = getRedisClient()
  let displayData: any[] = []
  let hasNextPage = false

  try {
    const rawList = await redis.lrange<any>('media:recent', 0, 199)
    const allItems = (rawList || []).map(item => typeof item === 'string' ? JSON.parse(item) : item)
    const filtered = q ? allItems.filter(item => item.title?.toLowerCase().includes(q.toLowerCase())) : allItems
    const start = (page - 1) * PAGE_SIZE
    displayData = filtered.slice(start, start + PAGE_SIZE)
    hasNextPage = filtered.length > start + PAGE_SIZE
  } catch (error) {
    console.error('Failed to fetch discover list from Redis:', error)
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

        <DiscoverGrid 
          initialData={displayData} 
          currentPage={page}
          hasNextPage={hasNextPage}
        />
        
        <div className="pt-12 border-t border-white/5">
            <AdBanner adKey="discover-bottom" width={728} height={90} />
        </div>
      </div>
    </main>
  )
}
