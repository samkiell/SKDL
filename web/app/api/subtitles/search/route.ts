import { NextRequest, NextResponse } from 'next/server';
import { searchMovieBox, getMovieBoxDetails } from '@/lib/moviebox';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const lang = searchParams.get('lang') || 'en';
  const year = searchParams.get('year');

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results: any[] = [];

  // 1. Try MovieBox Search (Primary)
  try {
    const movieBoxItem = await searchMovieBox(query, 'movie') || await searchMovieBox(query, 'series');
    if (movieBoxItem) {
      const details = await getMovieBoxDetails(movieBoxItem.subjectId, 'movie'); // dummy type for search
      const englishSub = details.captions.find(c => c.lan === 'en' || c.lanName.toLowerCase().includes('english'));
      
      if (englishSub) {
        results.push({
          id: `moviebox_${movieBoxItem.subjectId}`,
          title: movieBoxItem.title,
          year: 'BEST MATCH',
          language: 'English',
          downloads: 9999,
          rating: 5,
          release_name: movieBoxItem.title,
          file_id: 'moviebox_direct',
          imdb_id: '',
          isBestMatch: true,
          subtitleUrl: englishSub.url,
          poster_url: movieBoxItem.cover.url,
        });
      }
    }
  } catch (e) {
    console.error('MovieBox Search Error:', e);
  }

  // 2. OpenSubtitles Search (Fallback/Secondary)
  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (apiKey) {
    try {
      const url = new URL('https://api.opensubtitles.com/api/v1/subtitles');
      url.searchParams.append('query', query);
      url.searchParams.append('languages', lang);
      if (year) {
        url.searchParams.append('year', year);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'SKDL v1.0',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const osResults = (data.data || []).map((item: any) => {
          const attr = item.attributes || {};
          const feature = attr.feature_details || {};
          
          return {
            id: item.id,
            title: feature.title || attr.release || 'Unknown Title',
            year: feature.year || attr.year || 'N/A',
            language: attr.language || lang,
            downloads: attr.download_count || 0,
            rating: attr.ratings || 0,
            release_name: attr.release || 'N/A',
            file_id: attr.files?.[0]?.file_id || '',
            imdb_id: feature.imdb_id || '',
          };
        });
        results.push(...osResults);
      }
    } catch (error) {
      console.error('OpenSubtitles search error:', error);
    }
  }

  return NextResponse.json({ results: results.slice(0, 25) });
}
