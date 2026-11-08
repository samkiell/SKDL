import { NextRequest, NextResponse } from 'next/server'

async function fromOpenSubtitles(imdbId: string | null, query: string | null, lang: string): Promise<{ subtitleUrl: string; fileName: string } | null> {
  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (!apiKey) return null;

  try {
    let searchUrl = '';
    if (imdbId && imdbId !== 'null' && imdbId !== 'undefined' && imdbId.trim() !== '') {
      searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbId.replace('tt', '')}&languages=${lang}`;
    } else if (query) {
      searchUrl = `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(query)}&languages=${lang}`;
    } else {
      return null;
    }

    const searchRes = await fetch(searchUrl, {
      headers: {
        'Api-Key': apiKey,
        'User-Agent': 'SKDL v1.0',
        'Accept': 'application/json',
      },
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    if (!searchData.data || searchData.data.length === 0) return null;

    // Best match logic
    let bestIndex = 0;
    const keywords = ['WEB-DL', 'WEBRip', 'DVDRip', 'Bluray', 'BRRip', '1080p', '720p'];
    for (let i = 0; i < searchData.data.length; i++) {
      const releaseName = (searchData.data[i].attributes.release || '').toUpperCase();
      if (keywords.some(k => releaseName.includes(k.toUpperCase()))) {
        bestIndex = i;
        break;
      }
    }

    const selectedSub = searchData.data[bestIndex];
    const fileId = selectedSub.attributes.files[0].file_id;

    const downloadRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'User-Agent': 'SKDL v1.0',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!downloadRes.ok) return null;
    const downloadData = await downloadRes.json();

    return {
      subtitleUrl: downloadData.link,
      fileName: downloadData.file_name,
    };
  } catch (e) {
    console.error('[subtitles] OpenSubtitles resolution error:', e);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get('imdb_id');
  const query = searchParams.get('query');
  const lang = searchParams.get('lang') || 'en';

  const result = await fromOpenSubtitles(imdbId, query, lang);

  if (result) {
    return NextResponse.json({
      found: true,
      subtitleUrl: result.subtitleUrl,
      fileName: result.fileName,
    });
  }

  return NextResponse.json({ found: false });
}
