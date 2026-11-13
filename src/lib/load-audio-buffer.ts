/**
 * Load + decode a Freesound preview without Tone's shared download list.
 *
 * Fetched directly from cdn.freesound.org by the user's browser. (A same-origin
 * proxy used to back this up, but the server's egress IP is blocked by
 * Freesound, so it only ever failed in prod and was removed.) Generous timeout:
 * Freesound's CDN sits around 70KB/s.
 */

export const CANDIDATE_TIMEOUT_MS = 20_000;

/** Rewrite Freesound `-hq.` preview URLs to `-lq.` (no-op if already LQ). */
export function lowQualityPreviewUrl(url: string): string {
  return url.replace('-hq.', '-lq.');
}

export function audioLoadCandidates(previewUrl: string): string[] {
  const lq = lowQualityPreviewUrl(previewUrl);
  return lq === previewUrl ? [lq] : [lq, previewUrl];
}

async function fetchAudioArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(CANDIDATE_TIMEOUT_MS),
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
