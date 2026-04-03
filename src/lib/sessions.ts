import type { ScaleName, DelayTime } from '@/components/AudioEngine';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const SESSION_VERSION = 1;
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
  type: 'synth' | 'melodic';
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
  type: 'freesound' | 'grain' | 'synth' | 'melodic';
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
          grainDrift: l.grainDrift ?? 0.04,
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

  if (session.version !== SESSION_VERSION) {
    throw new Error(
      `Unsupported session version (got ${session.version}, expected ${SESSION_VERSION}).`
    );
  }
  if (typeof session.id !== 'string' || typeof session.name !== 'string') {
    throw new Error('Session file is missing required fields (id, name).');
  }
  if (!Array.isArray(session.layers)) {
    throw new Error('Session file has no layers array.');
  }

  // Assign a fresh id to avoid collisions with existing local sessions
  return { ...(session as unknown as SavedSession), id: crypto.randomUUID() };
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
