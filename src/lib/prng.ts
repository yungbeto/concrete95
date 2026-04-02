/**
 * Mulberry32 seeded PRNG.
 * Single 32-bit integer seed → stateful closure that returns [0, 1) floats.
 * Fast, well-distributed, and reproducible across environments.
 */
export type RNG = () => number;

export function createRng(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Generates a random 4-digit seed (1000–9999) using Math.random() — only called once at session creation. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

/** Parses a seed from a URL param string. Returns null if invalid. */
export function parseSeed(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
