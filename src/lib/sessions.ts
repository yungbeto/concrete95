import type { ScaleName, DelayTime } from '@/components/AudioEngine';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const SESSION_VERSION = 1;

/**
 * Migrate a raw session object from an older version to the current schema.
 * Add a new `case` here whenever SESSION_VERSION is bumped.
 */
function migrateSession(raw: Record<string, unknown>): SavedSession {
  let s = raw;
  const from = typeof s.version === 'number' ? s.version : 0;

  // Example future migration:
  // if (from < 2) {
  //   s = { ...s, version: 2, settings: { ...(s.settings as object), newField: defaultValue } };
  // }

  if (from !== SESSION_VERSION) {
    // If no migration path exists, surface a clear error
    throw new Error(`Unsupported session version (got ${from}, expected ${SESSION_VERSION}).`);
  }

  return s as unknown as SavedSession;
}
const STORAGE_KEY = 'concrete95_sessions';

// ─── Serialisable layer types ─────────────────────────────────────────────────

export type SavedFreesoundLayer = {
  type: 'freesound';
  title: string;
  volume: number;
  send: number;
  position: { x: number; y: number };
  playbackRate: number;
  reverse: boolean;
  filterCutoff: number;
  filterResonance: number;
  freesoundId: number;
  freesoundName: string;
  previewUrl: string;
};

export type SavedGrainLayer = {
  type: 'grain';
  title: string;
  volume: number;
  send: number;
  position: { x: number; y: number };
  playbackRate: number;
  reverse: boolean;
  filterCutoff: number;
  filterResonance: number;
  freesoundId: number;
  freesoundName: string;
  previewUrl: string;
  grainSize: number;
  grainDrift: number;
};

export type SavedSynthLayer = {
  type: 'synth' | 'melodic' | 'atmosphere';
  title: string;
  volume: number;
  send: number;
  position: { x: number; y: number };
  filterCutoff: number;
  filterResonance: number;
  probability: number;
};

export type SavedLayer = SavedFreesoundLayer | SavedGrainLayer | SavedSynthLayer;

// ─── Global settings ──────────────────────────────────────────────────────────

export type SavedGlobalSettings = {
  scale: ScaleName;
  bpm: number;
  discreetMode: boolean;
  driftEnabled: boolean;
  driftPeriod: number;
  warmth: number;
  breatheEnabled: boolean;
  breathePeriod: number;
  delayFeedback: number;
  delayTime: DelayTime;
  delayCutoff: number;
  reverbDecay: number;
  reverbWet: number;
  reverbDiffusion: number;
  shimmer: number;
  seed?: number;
};

// ─── Session ──────────────────────────────────────────────────────────────────

export type SavedSession = {
  version: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: SavedGlobalSettings;
  layers: SavedLayer[];
};

// ─── localStorage CRUD ────────────────────────────────────────────────────────

function readAll(): SavedSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SavedSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** Returns all sessions sorted newest-first. */
export function listSessions(): SavedSession[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Creates or overwrites by session.id. */
export function saveSession(session: SavedSession): void {
  const all = readAll();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.push(session);
  }
  writeAll(all);
}

/** Returns null if not found. */
export function getSession(id: string): SavedSession | null {
  return readAll().find((s) => s.id === id) ?? null;
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

// ─── Build a session from runtime state ───────────────────────────────────────

type RuntimeLayer = {
  title: string;
  type: 'freesound' | 'grain' | 'synth' | 'melodic' | 'atmosphere';
  volume: number;
  send: number;
  position: { x: number; y: number };
  playbackRate?: number;
  reverse?: boolean;
  filterCutoff?: number;
  filterResonance?: number;
  probability?: number;
  grainSize?: number;
  grainDrift?: number;
  info?: { type: string; id?: number; name?: string; previewUrl?: string };
};

export function buildSession(
  name: string,
  layers: RuntimeLayer[],
  settings: SavedGlobalSettings,
  existingId?: string
): SavedSession {
  const now = new Date().toISOString();

  const savedLayers: SavedLayer[] = layers
    .filter((l) => l.type !== undefined)
    .map((l): SavedLayer => {
      if (l.type === 'freesound') {
        const info = l.info as { type: string; id?: number; name?: string; previewUrl?: string } | undefined;
        return {
          type: 'freesound',
          title: l.title,
          volume: l.volume,
          send: l.send,
          position: l.position,
          playbackRate: l.playbackRate ?? 1,
          reverse: l.reverse ?? false,
          filterCutoff: l.filterCutoff ?? 2000,
          filterResonance: l.filterResonance ?? 1,
          freesoundId: info?.id ?? 0,
          freesoundName: info?.name ?? l.title,
          previewUrl: info?.previewUrl ?? '',
        };
      } else if (l.type === 'grain') {
        const info = l.info as { type: string; id?: number; name?: string; previewUrl?: string } | undefined;
        return {
          type: 'grain',
          title: l.title,
          volume: l.volume,
          send: l.send,
          position: l.position,
          playbackRate: l.playbackRate ?? 1,
          reverse: l.reverse ?? false,
          filterCutoff: l.filterCutoff ?? 2000,
          filterResonance: l.filterResonance ?? 1,
          freesoundId: info?.id ?? 0,
          freesoundName: info?.name ?? l.title,
          previewUrl: info?.previewUrl ?? '',
          grainSize: l.grainSize ?? 0.1,
          grainDrift: l.grainDrift ?? 1.0,
        };
      } else {
        return {
          type: l.type,
          title: l.title,
          volume: l.volume,
          send: l.send,
          position: l.position,
          filterCutoff: l.filterCutoff ?? 2000,
          filterResonance: l.filterResonance ?? 1,
          probability: l.probability ?? 1,
        };
      }
    });

  return {
    version: SESSION_VERSION,
    id: existingId ?? crypto.randomUUID(),
    name,
    createdAt: existingId ? now : now,
    updatedAt: now,
    settings,
    layers: savedLayers,
  };
}

// ─── URL encoding ─────────────────────────────────────────────────────────────

import LZString from 'lz-string';

/** Encodes a session to a compressed URL-safe string for sharing via ?s= param. */
export function encodeSession(session: SavedSession): string {
  const json = JSON.stringify(JSON.parse(JSON.stringify(session))); // strip undefineds
  return LZString.compressToEncodedURIComponent(json);
}

/** Decodes a ?s= URL param back to a SavedSession. Returns null on any error. */
export function decodeSession(encoded: string): SavedSession | null {
  try {
    // Support both lz-string compressed (new) and raw base64 (old links)
    const json = LZString.decompressFromEncodedURIComponent(encoded)
      ?? (() => {
        const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      })();
    const raw = JSON.parse(json) as Record<string, unknown>;
    return migrateSession(raw);
  } catch {
    return null;
  }
}

// ─── Export / import ──────────────────────────────────────────────────────────

/** Triggers a .json download in the browser. */
export function exportSessionFile(session: SavedSession): void {
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.name.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parses and validates a JSON string. Throws a descriptive error on failure. */
export function importSessionFromString(jsonString: string): SavedSession {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON — could not parse file.');
  }

  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid session file format.');
  }

  const session = data as Record<string, unknown>;

  if (typeof session.id !== 'string' || typeof session.name !== 'string') {
    throw new Error('Session file is missing required fields (id, name).');
  }
  if (!Array.isArray(session.layers)) {
    throw new Error('Session file has no layers array.');
  }

  const migrated = migrateSession(session);
  // Assign a fresh id to avoid collisions with existing local sessions
  return { ...migrated, id: crypto.randomUUID() };
}

// ─── Firestore public sharing ─────────────────────────────────────────────────
// Collection path: shared_sessions/{shortId}
// Rules: allow read: if true; allow create: if true; allow update, delete: if false;

function generateShareId(): string {
  // 8-char base-36 string, e.g. "k4j2m8n1"
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => (b % 36).toString(36))
    .join('')
    .slice(0, 8);
}

export async function saveSharedSession(session: SavedSession): Promise<string> {
  const id = generateShareId();
  const data = JSON.parse(JSON.stringify(session));
  await setDoc(doc(db, 'shared_sessions', id), { ...data, _sharedAt: new Date().toISOString() });
  return id;
}

export async function loadSharedSession(id: string): Promise<SavedSession | null> {
  try {
    const docSnap = await getDoc(doc(db, 'shared_sessions', id));
    if (!docSnap.exists()) return null;
    const data = docSnap.data() as Record<string, unknown>;
    return migrateSession(data);
  } catch {
    return null;
  }
}

// ─── Firestore CRUD (authenticated users) ────────────────────────────────────
// Collection path: users/{uid}/sessions/{sessionId}

export async function listUserSessions(uid: string): Promise<SavedSession[]> {
  const q = query(
    collection(db, 'users', uid, 'sessions'),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SavedSession);
}

export async function saveUserSession(uid: string, session: SavedSession): Promise<void> {
  const data = JSON.parse(JSON.stringify(session));
  await setDoc(doc(db, 'users', uid, 'sessions', session.id), data);
}

export async function deleteUserSession(uid: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
}
