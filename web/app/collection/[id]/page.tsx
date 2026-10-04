import { notFound } from 'next/navigation'
import { getRedisClient } from '@/lib/redis'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Collection {
  id: string
  title: string
  season: number
  media_ids: string[]
}

interface MediaRow {
  id: string
  title: string
  season: number
  episode: number
  quality: string
  cdn_url: string
  poster_url?: string
}

function getSafeFilename(row: MediaRow): string {
  let name = row.title.replace(/[^a-zA-Z0-9.\- _]/g, '').trim()
  name += ` - S${row.season.toString().padStart(2, '0')}E${row.episode.toString().padStart(2, '0')}`
  return name + '.mp4'
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const redis = getRedisClient()

  const colData = await redis.get<Collection>(`collection:${id}`)
  if (!colData) {
    return notFound()
  }

  const collection = colData as Collection
  const mediaKeys = collection.media_ids.map(mid => `media:${mid}`)
  const rawEpisodes = mediaKeys.length > 0 ? await redis.mget<MediaRow[]>(...mediaKeys) : []
  const episodes = (rawEpisodes.filter(Boolean) as MediaRow[]).sort((a, b) => (a.episode || 0) - (b.episode || 0))

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-24 pb-12 px-4 md:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2 border-b border-white/10 pb-6">
          <p className="text-xs font-mono text-[#e8ff47] uppercase tracking-widest">
            Season Collection
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
            {collection.title}
          </h1>
          <p className="text-sm text-zinc-400 font-mono">
            {episodes.length} Episodes • Season {collection.season}
          </p>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 border-b border-white/10 font-mono text-xs uppercase text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-normal">Episode</th>
                <th className="px-6 py-4 font-normal">Quality</th>
                <th className="px-6 py-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {episodes.map(ep => {
                const safeName = encodeURIComponent(getSafeFilename(ep))
                // Note: To enforce filename through our proxy: /api/proxy?url=XYZ&filename=XYZ&dl=1
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(ep.cdn_url)}&filename=${safeName}&dl=1`
                
                return (
                  <tr key={ep.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono">
                      <span className="text-zinc-500 mr-2">E{ep.episode.toString().padStart(2, '0')}</span>
                      <span className="text-zinc-200 truncate hidden md:inline-block md:max-w-xs">{ep.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-1 rounded bg-white/10 text-zinc-300 font-mono inline-flex items-center">
                        {ep.quality}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/download/${ep.id}?title=${encodeURIComponent(ep.title)}&poster=${encodeURIComponent(ep.poster_url || '')}`}
                        className="inline-block bg-white text-black text-xs font-bold px-4 py-2 rounded shadow-sm hover:bg-zinc-200 transition-colors uppercase tracking-wider"
                      >
                        Download
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {episodes.length === 0 && (
            <div className="p-8 text-center text-zinc-500 font-mono">
              No episodes found in this collection.
            </div>
          )}
        </div>
        
      </div>
    </main>
  )
}
