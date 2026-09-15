/**
 * Load + decode a Freesound preview without Tone's shared download list.
 *
 * HQ MP3s are often 1–2MB and Freesound's CDN sits around 70KB/s, so a
 * proxy that buffers the whole file before responding has TTFB ≈ 20s+.
 * The client used to abort at 25s — layers looked stuck until another
 * request happened to finish around the same time.
 *
 * Strategy: try the low-quality CDN URL first (CORS is *), then HQ, then
 * the same paths through our streaming proxy.
 */

export const AUDIO_CANDIDATE_TIMEOUT_MS = 20_000;

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

export function audioLoadCandidates(previewUrl: string): string[] {
  const lq = lowQualityPreviewUrl(previewUrl);
  const ordered = lq === previewUrl ? [previewUrl] : [lq, previewUrl];
  const withProxy = ordered.flatMap((url) => {
    const proxied = proxyAudioUrl(url);
    return proxied === url ? [url] : [url, proxied];
  });
  return [...new Set(withProxy)];
}

export async function loadDecodedAudioBuffer(
  previewUrl: string,
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>,
): Promise<AudioBuffer> {
  const candidates = audioLoadCandidates(previewUrl);
  let lastError: unknown;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(AUDIO_CANDIDATE_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.arrayBuffer();
      if (data.byteLength < 64) {
        throw new Error('Empty audio response');
      }
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
