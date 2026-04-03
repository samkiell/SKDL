export interface MovieBoxDownload {
  url: string
  resolution: number
  size?: number
}

export interface MovieBoxCaption {
  url: string
  lan: string
  lanName: string
}

export interface MovieBoxSearchResult {
  subjectId: string
  title: string
  cover: {
    url: string
  }
}

const API_HOST = "h5-api.aoneroom.com"
const REFERER_BASE = "https://h5.aoneroom.com"

const DEFAULT_HEADERS = {
  'Referer': `${REFERER_BASE}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}

export async function searchMovieBox(
  query: string,
  type: 'movie' | 'series'
): Promise<MovieBoxSearchResult | null> {
  const url = `https://${API_HOST}/wefeed-h5-bff/web/subject/search`
  const subjectType = type === 'movie' ? 1 : 2

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: query,
        page: 1,
        perPage: 10,
        subjectType
      }),
      cache: 'no-store'
    })

    if (!response.ok) return null
    const json = await response.json()
    return json.data?.items?.[0] || null
  } catch (e) {
    console.error('MovieBox Search Error:', e)
    return null
  }
}

export async function getMovieBoxDetails(
  subjectId: string, 
  type: 'movie' | 'series',
  season: number = 0,
  episode: number = 0
): Promise<{ downloads: MovieBoxDownload[], captions: MovieBoxCaption[] }> {
  // If season and episode are both 0, treat it as a movie download path
  const isMoviePath = type === 'movie' || (season === 0 && episode === 0);
  
  let url = `https://${API_HOST}/wefeed-h5-bff/web/subject/download?subjectId=${subjectId}`
  
  // Only pass se and ep for series episodes (not for movies or the 0/0 case)
  if (!isMoviePath) {
    url += `&se=${season}&ep=${episode}`
  }
  
  const response = await fetch(url, { headers: DEFAULT_HEADERS, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`MovieBox API failed: ${response.statusText}`)
  }

  const json = await response.json()
  const downloads: MovieBoxDownload[] = json.data?.downloads || []
  const captions: MovieBoxCaption[] = json.data?.captions || []
  
  return { downloads, captions }
}

export async function getFreshCdnUrl(
  subjectId: string, 
  type: 'movie' | 'series',
  season: number = 0,
  episode: number = 0
): Promise<string> {
  const { downloads } = await getMovieBoxDetails(subjectId, type, season, episode)
  
  if (downloads.length === 0) {
    throw new Error('No downloads found for this content')
  }

  // Pick highest resolution available
  const sorted = downloads.sort((a, b) => (b.resolution || 0) - (a.resolution || 0))
  return sorted[0].url
}
