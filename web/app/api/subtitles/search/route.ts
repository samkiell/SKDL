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

  const results: any[] = [];

  const apiKey = process.env.OPENSUBTITLES_API_KEY;
  if (apiKey) {
    try {
      const url = new URL('https://api.opensubtitles.com/api/v1/subtitles');
      url.searchParams.set('query', query);
      url.searchParams.set('languages', lang);
      if (year) url.searchParams.set('year', year);

      const res = await fetch(url.toString(), {
        headers: {
          'Api-Key': apiKey,
          'User-Agent': 'SKDL v1.0',
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          data.data.forEach((item: any) => {
            const attr = item.attributes;
            const file = attr.files?.[0];
            if (file) {
              results.push({
                id: item.id,
                title: attr.feature_details?.movie_name || query,
                year: attr.feature_details?.year,
                language: attr.language,
                downloads: attr.download_count,
                rating: attr.ratings,
                release_name: attr.release,
                file_id: file.file_id,
                imdb_id: attr.feature_details?.imdb_id,
              });
            }
          });
        }
      }
    } catch (e) {
      console.error('OpenSubtitles Search Error:', e);
    }
  }

  return NextResponse.json({ results });
}
