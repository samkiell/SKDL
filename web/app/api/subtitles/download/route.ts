import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { file_id, release_name } = await req.json();

    if (!file_id) {
      return NextResponse.json({ error: 'file_id is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    if (!apiKey) {
      console.error('OPENSUBTITLES_API_KEY is not set');
      return NextResponse.json({ error: 'API key configuration missing' }, { status: 500 });
    }

    // Step 1: Request download link
    const downloadLinkResponse = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'SKDL v1.0',
      },
      body: JSON.stringify({ file_id }),
    });

    if (!downloadLinkResponse.ok) {
      const errorData = await downloadLinkResponse.json().catch(() => ({}));
      console.error('OpenSubtitles Download Response Error:', downloadLinkResponse.status, errorData);
      
      if (downloadLinkResponse.status === 429 || downloadLinkResponse.status === 406) {
        return NextResponse.json({ error: 'Daily subtitle quota reached, try again tomorrow' }, { status: downloadLinkResponse.status });
      }
      
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: downloadLinkResponse.status });
    }

    const { link } = await downloadLinkResponse.json();

    if (!link) {
      return NextResponse.json({ error: 'No download link returned' }, { status: 500 });
    }

    return NextResponse.json({ url: link });

  } catch (error) {
    console.error('Subtitle download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
