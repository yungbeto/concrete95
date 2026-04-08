/**
 * Opt-in audio diagnostics (console + optional UI).
 *
 * Enable any of:
 * - URL: `?debugAudio=1` (works in prod builds too)
 * - localStorage: `localStorage.setItem('concrete95:debugAudio', '1')` then reload (dev-friendly)
 */
export function isAudioDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('concrete95:debugAudio') === '1') return true;
  } catch {
    /* private mode / blocked */
  }
  try {
    return new URLSearchParams(window.location.search).get('debugAudio') === '1';
  } catch {
    return false;
  }
}

/** Prefix console lines so you can filter DevTools → `C95-audio`. */
export function audioDebugLog(...args: unknown[]) {
  if (!isAudioDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[C95-audio]', ...args);
}
