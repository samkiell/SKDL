import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const lang = searchParams.get('lang') || 'en';
  const year = searchParams.get('year');

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.OPENSUBTITLES_API_KEY;

  if (!apiKey) {
    console.error('OPENSUBTITLES_API_KEY is not set');
    return NextResponse.json({ error: 'API key configuration missing' }, { status: 500 });
  }

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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenSubtitles Search Error:', response.status, errorData);
      
      if (response.status === 401) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
      }
      
      if (response.status === 429 || response.status === 406) {
        return NextResponse.json({ error: 'Daily subtitle quota reached, try again tomorrow' }, { status: response.status });
      }

      return NextResponse.json({ results: [] });
    }

    const data = await response.json();
    
    // Map OpenSubtitles v1 API response to our schema
    const results = (data.data || []).map((item: any) => {
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
    }).slice(0, 20);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Subtitle search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
