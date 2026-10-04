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
  description?: string
  releaseDate?: {
    year: number
  }
}

const API_HOST = "h5-api.aoneroom.com"
const SEARCH_HOST = "h5.aoneroom.com"
const REFERER_BASE = "https://h5.aoneroom.com"

const DEFAULT_HEADERS = {
  'Referer': 'https://videodownloader.site/',
  'Origin': 'https://videodownloader.site',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
}

async function fetchWithTimeout(url: string, options: any = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function searchMovieBox(
  query: string,
  type: 'movie' | 'series'
): Promise<MovieBoxSearchResult | null> {
  const url = `https://${SEARCH_HOST}/wefeed-h5-bff/web/subject/search`
  const subjectType = type === 'movie' ? 1 : 2

  try {
    const response = await fetchWithTimeout(url, {
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
  
  let url = `https://${API_HOST}/wefeed-h5api-bff/subject/download?subjectId=${subjectId}`
  
  // Only pass se and ep for series episodes (not for movies or the 0/0 case)
  if (!isMoviePath) {
    url += `&se=${season}&ep=${episode}`
  }
  
  try {
    let response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS, cache: 'no-store' })
    if (!response.ok) {
        response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS, cache: 'no-store' })
    }
    if (!response.ok) {
      console.warn(`MovieBox Detail Fetch Warning: ${response.status} ${response.statusText} for ID ${subjectId}`)
      return { downloads: [], captions: [] }
    }

    const json = await response.json()
    const rawDownloads = json.data?.downloads || []
    const downloads: MovieBoxDownload[] = rawDownloads.map((d: any) => ({
      url: d.url,
      resolution: Number(d.resolution) || 0,
      size: Number(d.size) || 0
    }))
    const captions: MovieBoxCaption[] = json.data?.captions || []
    
    return { downloads, captions }
  } catch (err) {
    console.error('MovieBox Detail API Error:', err)
    return { downloads: [], captions: [] }
  }
}

export async function getMediaInfo(
  title: string,
  type: 'movie' | 'series'
): Promise<MovieBoxSearchResult & { description?: string; year?: number } | null> {
  const searchResult = await searchMovieBox(title, type)
  if (!searchResult) return null

  // We could fetch more details here if needed, but search result usually has cover
  // and we can infer year from releaseDate if we update searchMovieBox to return it.
  return searchResult
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
