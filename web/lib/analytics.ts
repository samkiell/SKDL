import { getRedisClient } from './redis'

const KEYS = {
  visitsDaily: 'analytics:visits:daily',
  pages: 'analytics:pages',
  dlDaily: 'analytics:downloads:daily',
  dlMedia: 'analytics:downloads:media',
  dlFormat: 'analytics:downloads:format',
  dlType: 'analytics:downloads:type',
}

const DAY_MS = 24 * 60 * 60 * 1000
const KNOWN_ROUTES = new Set(['discover', 'feedback', 'privacy', 'terms', 'sub', 'download', 'collection'])

// UTC day keys are used for both writes and reads so they always line up.
const utcDay = (date = new Date()) => date.toISOString().slice(0, 10)

/** Collapse per-link paths so the pages hash stays small. Returns null for paths we never track. */
export function normalizePath(path: string): string | null {
  const clean = (path || '/').split('?')[0].split('#')[0]
  if (clean.startsWith('/lighthouse')) return null
  const segments = clean.split('/').filter(Boolean)
  if (segments.length === 0) return '/'
  if (KNOWN_ROUTES.has(segments[0])) return `/${segments[0]}`
  return '/[id]'
}

export async function trackPageview(path: string) {
  const normalized = normalizePath(path)
  if (!normalized) return
  const redis = getRedisClient()
  await redis
    .pipeline()
    .hincrby(KEYS.visitsDaily, utcDay(), 1)
    .hincrby(KEYS.pages, normalized, 1)
    .exec()
}

export async function trackDownload(input: { title?: string; media_type?: string; format?: string }) {
  const title = (input.title || 'Unknown').slice(0, 120).replace(/\|/g, '/')
  const mediaType = input.media_type || 'unknown'
  const format = input.format || 'unknown'
  const redis = getRedisClient()
  await redis
    .pipeline()
    .hincrby(KEYS.dlDaily, utcDay(), 1)
    .hincrby(KEYS.dlMedia, `${title}|${mediaType}`, 1)
    .hincrby(KEYS.dlFormat, format, 1)
    .hincrby(KEYS.dlType, mediaType, 1)
    .exec()
}

type Counts = Record<string, number>

const toCounts = (raw: unknown): Counts => {
  const out: Counts = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = Number(v) || 0
  }
  return out
}

const sumLastDays = (counts: Counts, days: number) => {
  let total = 0
  for (let i = 0; i < days; i++) total += counts[utcDay(new Date(Date.now() - i * DAY_MS))] || 0
  return total
}

export async function getTrafficStats() {
  const empty = {
    visits: { today: 0, week: 0, month: 0 },
    downloads: { today: 0, week: 0, month: 0 },
    dailyVisits: [] as { day: string; visits: number }[],
    topPages: [] as { path: string; visits: number }[],
    topDownloads: [] as { title: string; media_type: string; download_count: number }[],
    formatBreakdown: {} as Counts,
    typeBreakdown: {} as Counts,
  }

  try {
    const redis = getRedisClient()
    const [visitsRaw, pagesRaw, dlDailyRaw, dlMediaRaw, dlFormatRaw, dlTypeRaw] = await redis
      .pipeline()
      .hgetall(KEYS.visitsDaily)
      .hgetall(KEYS.pages)
      .hgetall(KEYS.dlDaily)
      .hgetall(KEYS.dlMedia)
      .hgetall(KEYS.dlFormat)
      .hgetall(KEYS.dlType)
      .exec()

    const visitsDaily = toCounts(visitsRaw)
    const dlDaily = toCounts(dlDailyRaw)

    const dailyVisits: { day: string; visits: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const day = utcDay(new Date(Date.now() - i * DAY_MS))
      dailyVisits.push({ day, visits: visitsDaily[day] || 0 })
    }

    const topPages = Object.entries(toCounts(pagesRaw))
      .map(([path, visits]) => ({ path, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)

    const topDownloads = Object.entries(toCounts(dlMediaRaw))
      .map(([key, download_count]) => {
        const sep = key.lastIndexOf('|')
        return { title: key.slice(0, sep), media_type: key.slice(sep + 1), download_count }
      })
      .sort((a, b) => b.download_count - a.download_count)
      .slice(0, 10)

    return {
      visits: { today: sumLastDays(visitsDaily, 1), week: sumLastDays(visitsDaily, 7), month: sumLastDays(visitsDaily, 30) },
      downloads: { today: sumLastDays(dlDaily, 1), week: sumLastDays(dlDaily, 7), month: sumLastDays(dlDaily, 30) },
      dailyVisits,
      topPages,
      topDownloads,
      formatBreakdown: toCounts(dlFormatRaw),
      typeBreakdown: toCounts(dlTypeRaw),
    }
  } catch (error) {
    console.error('Error fetching traffic stats from Redis:', error)
    return empty
  }
}
