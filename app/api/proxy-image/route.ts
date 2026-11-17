import { NextRequest, NextResponse } from 'next/server';
import { fetchRemoteImage, ImageFetchError } from '@/lib/safe-image-fetch';

export const runtime = 'nodejs';

// Proxy external images so the certificate canvas isn't tainted by CORS.
// All SSRF / content checks live in fetchRemoteImage.
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
  }

  try {
    const { body, type } = await fetchRemoteImage(rawUrl);

    return new NextResponse(new Uint8Array(body), {
      headers: {
        // Type comes from the file's bytes, never from the upstream server.
        'Content-Type': type,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        // If someone opens this URL directly, nothing in it can run.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        // Only our own pages may embed it (stops hotlinking through the proxy).
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch (err) {
    if (err instanceof ImageFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Proxy image error:', err);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }
}
