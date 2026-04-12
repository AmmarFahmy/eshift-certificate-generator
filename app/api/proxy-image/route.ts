import { NextRequest, NextResponse } from 'next/server';

// Proxy external images to avoid canvas CORS taint issues
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 });
  }

  // Only allow http and https URLs (prevent SSRF to internal metadata services etc.)
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http/https URLs are allowed' }, { status: 400 });
  }

  // Block private/internal IP ranges
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost',
    '127.',
    '0.',
    '10.',
    '192.168.',
    '172.',
    '169.254.',
    '[::1]',
    '::1',
    'metadata.google.internal',
    '169.254.169.254',
  ];
  if (blocked.some((b) => hostname === b || hostname.startsWith(b))) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  try {
    const response = await fetch(rawUrl, {
      headers: { 'User-Agent': 'CertificateGenerator/1.0' },
      // Limit to image-sized responses with a signal
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Proxy image error:', err);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 });
  }
}
