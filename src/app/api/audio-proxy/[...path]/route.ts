import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
    });
  } catch (e) {
    return new NextResponse('Upstream fetch failed', { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse('Upstream error', { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
