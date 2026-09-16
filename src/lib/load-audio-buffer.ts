/**
 * Load + decode a Freesound preview without Tone's shared download list.
 *
 * cdn.freesound.org is blocked from the server's egress IP (same edge
 * block as the search API — see project notes), so the same-origin proxy
 * now fails fast every time in prod. The user's own browser isn't
 * affected, so try the direct CDN URL first with a generous timeout
 * (Freesound's CDN sits around 70KB/s) and keep the proxy only as a
 * short-timeout backup (useful locally, or if the block ever lifts).
 */

export const DIRECT_CANDIDATE_TIMEOUT_MS = 20_000;
export const PROXY_CANDIDATE_TIMEOUT_MS = 4_000;

export function proxyAudioUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    return `/api/audio-proxy${pathname}`;
  } catch {
    return url;
  }
}

/** Rewrite Freesound `-hq.` preview URLs to `-lq.` (no-op if already LQ). */
export function lowQualityPreviewUrl(url: string): string {
  return url.replace('-hq.', '-lq.');
}

function isProxyUrl(url: string): boolean {
  return url.includes('/api/audio-proxy');
}

export function audioLoadCandidates(previewUrl: string): string[] {
  const lq = lowQualityPreviewUrl(previewUrl);
  const ordered = lq === previewUrl ? [lq] : [lq, previewUrl];
  return [
    ...new Set(
      ordered.flatMap((url) => {
        const proxied = proxyAudioUrl(url);
        return proxied === url ? [url] : [url, proxied];
      }),
    ),
  ];
}

async function fetchAudioArrayBuffer(url: string): Promise<ArrayBuffer> {
  const timeoutMs = isProxyUrl(url)
    ? PROXY_CANDIDATE_TIMEOUT_MS
    : DIRECT_CANDIDATE_TIMEOUT_MS;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.arrayBuffer();
  if (data.byteLength < 64) {
    throw new Error('Empty audio response');
  }
  return data;
}

export async function loadDecodedAudioBuffer(
  previewUrl: string,
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>,
): Promise<AudioBuffer> {
  const candidates = audioLoadCandidates(previewUrl);
  let lastError: unknown;

  for (const url of candidates) {
    try {
      const data = await fetchAudioArrayBuffer(url);
      // slice() so Safari/standardized-audio-context can detach a copy.
      return await decode(data.slice(0));
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    const timedOut =
      lastError.name === 'TimeoutError' ||
      lastError.name === 'AbortError' ||
      /timed out|aborted/i.test(lastError.message);
    throw new Error(
      timedOut
        ? 'Freesound was too slow to respond. Try again.'
        : `Failed to load sample (${lastError.message})`,
    );
  }
  throw new Error('Failed to load sample.');
}
