import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const imdbId = searchParams.get('imdb_id')
  const lang = searchParams.get('lang') || 'en'

  if (!imdbId) {
    return NextResponse.json({ error: 'Missing imdb_id' }, { status: 400 })
  }

  const apiKey = process.env.OPENSUBTITLES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenSubtitles API key not configured' }, { status: 500 })
  }

  try {
    // 1. Search for subtitles by IMDB ID if available
    let searchUrl = ''
    if (imdbId && imdbId !== 'null' && imdbId !== 'undefined' && imdbId.trim() !== '') {
        searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbId.replace('tt', '')}&languages=${lang}`
    } else if (request.nextUrl.searchParams.get('query')) {
        // Fallback to title search
        const query = request.nextUrl.searchParams.get('query')
        searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(query!)}&languages=${lang}`
    } else {
        return NextResponse.json({ found: false, error: 'No search criteria provided' })
    }

    const searchRes = await fetch(searchUrl, {
      headers: {
        'Api-Key': apiKey,
        'User-Agent': 'SKDL v1.0',
        'Accept': 'application/json',
      },
    })

    if (!searchRes.ok) {
      const errText = await searchRes.text()
      console.error('OpenSubtitles Search Error:', errText)
      return NextResponse.json({ found: false, error: 'OpenSubtitles search failed' })
    }

    let searchData = await searchRes.json()
    
    // If ID search failed to find anything, try query search if available
    if ((!searchData.data || searchData.data.length === 0) && imdbId && request.nextUrl.searchParams.get('query')) {
        console.log(`[api/subtitles] ID search for ${imdbId} empty, falling back to title search...`)
        const fallbackUrl = `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(request.nextUrl.searchParams.get('query')!)}&languages=${lang}`
        const fallbackRes = await fetch(fallbackUrl, {
            headers: {
                'Api-Key': apiKey,
                'User-Agent': 'SKDL v1.0',
                'Accept': 'application/json',
            },
        })
        if (fallbackRes.ok) {
            searchData = await fallbackRes.json()
        }
    }

    if (!searchData.data || searchData.data.length === 0) {
      return NextResponse.json({ found: false })
    }

    // 2. Get the file_id of the first subtitle
    const fileId = searchData.data[0].attributes.files[0].file_id

    // 3. Get the download link
    const downloadRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'User-Agent': 'SKDL v1.0',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId }),
    })

    if (!downloadRes.ok) {
        const errText = await downloadRes.text()
        console.error('OpenSubtitles Download Error:', errText)
        return NextResponse.json({ found: false, error: 'Download link resolution failed' })
    }

    const downloadData = await downloadRes.json()
    return NextResponse.json({
      found: true,
      subtitleUrl: downloadData.link,
      fileName: downloadData.file_name,
    })

  } catch (err: any) {
    console.error('Subtitle API caught error:', err)
    return NextResponse.json({ found: false, error: err.message }, { status: 500 })
  }
}
