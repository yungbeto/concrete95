import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const UPSTREAM_TIMEOUT_MS = 45_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const upstreamUrl = `https://cdn.freesound.org/${path.join('/')}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'concrete95/1.0' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return new NextResponse('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new NextResponse('Upstream error', { status: upstream.status || 502 });
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
    'Cache-Control': 'public, max-age=86400, immutable',
    'Access-Control-Allow-Origin': '*',
  });
  const length = upstream.headers.get('Content-Length');
  if (length) headers.set('Content-Length', length);

  // Pipe through — buffering the whole MP3 made TTFB ≈ CDN download time (~20s).
  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  });
}
