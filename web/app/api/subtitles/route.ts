import { NextRequest, NextResponse } from 'next/server'
import { searchMovieBox, getMovieBoxDetails } from '@/lib/moviebox'

async function fromMoviebox(imdbId: string | null, query: string | null, type?: string | null, season?: number, episode?: number): Promise<{ subtitleUrl: string; fileName: string } | null> {
  try {
    let subjectId = null;
    let contentType: 'movie' | 'series' = (type as 'movie' | 'series') || 'movie';

    // 1. If we have an IMDb ID, we still might need to search MovieBox to find their subjectId
    // unless we decide to store subjectId in the DB (which we do, but the player might not have it yet)
    
    // searchMovieBox currently only takes query. I'll use query or imdbId as keyword
    const searchTerm = query || imdbId;
    if (!searchTerm) return null;

    const searchResult = await searchMovieBox(searchTerm, contentType);
    if (searchResult) {
      subjectId = searchResult.subjectId;
    }

    if (!subjectId) return null;

    const { captions } = await getMovieBoxDetails(subjectId, contentType, season || 0, episode || 0);
    
    // Find English caption
    const englishCaption = captions.find(c => c.lan === 'en' || c.lanName.toLowerCase().includes('english'));
    
    if (englishCaption) {
      return {
        subtitleUrl: englishCaption.url,
        fileName: `moviebox_en_${subjectId}.srt`
      };
    }
  } catch (e) {
    console.error('[subtitles] MovieBox fallback error:', e);
  }
  return null;
}

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
    console.error('[subtitles] OpenSubtitles fallback error:', e);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get('imdb_id');
  const query = searchParams.get('query');
  const lang = searchParams.get('lang') || 'en';
  const type = searchParams.get('type');
  const season = parseInt(searchParams.get('season') || '0');
  const episode = parseInt(searchParams.get('episode') || '0');

  const result = 
    await fromMoviebox(imdbId, query, type, season, episode) ||
    await fromOpenSubtitles(imdbId, query, lang) ||
    null;

  if (result) {
    return NextResponse.json({
      found: true,
      subtitleUrl: result.subtitleUrl,
      fileName: result.fileName,
    });
  }

  return NextResponse.json({ found: false });
}
