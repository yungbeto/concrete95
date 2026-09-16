import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// TEMP DIAGNOSTIC ROUTE — remove after confirming the cause of the prod
// Freesound 403. Validates whether the block is IP/edge-level (applies to
// the plain freesound.org homepage and to requests with a garbage token,
// not just our real API key hitting /apiv2/search).

async function probe(label: string, url: string, headers?: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'concrete95/1.0 (+https://concrete95.net)', ...headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    const result = {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      bodyPreview: body.slice(0, 300),
    };
    console.error(`[freesound-diag] ${label}:`, JSON.stringify(result));
    return result;
  } catch (error) {
    const result = { error: error instanceof Error ? error.message : String(error) };
    console.error(`[freesound-diag] ${label} FAILED:`, JSON.stringify(result));
    return result;
  }
}

export async function GET() {
  const apiKey = process.env.FREESOUND_API_KEY ?? '';

  const [egressIp, homepage, badToken, realToken] = await Promise.all([
    probe('egressIp', 'https://api.ipify.org?format=json'),
    probe('freesoundHomepage', 'https://freesound.org/'),
    probe(
      'badToken',
      'https://freesound.org/apiv2/search/text/?query=rain&page_size=1&token=INVALIDTOKENXYZ123',
    ),
    probe(
      'realToken',
      `https://freesound.org/apiv2/search/text/?query=rain&page_size=1&token=${apiKey}`,
    ),
  ]);

  const summary = { egressIp, homepage, badToken, realToken };
  console.error('[freesound-diag] SUMMARY:', JSON.stringify(summary));
  return NextResponse.json(summary);
}
