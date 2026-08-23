import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

const STORAGE_KEY = 'concrete95_guestbook';
const LAST_SEEN_KEY = 'concrete95_guestbook_last_seen';
const COLLECTION = 'guestbook_entries';
const MAX_NAME = 50;
const MAX_MESSAGE = 500;
const MAX_ENTRIES = 200;
export const GUESTBOOK_RECENT_MS = 3 * 24 * 60 * 60 * 1000;

function isRecentEntry(createdAt: string, withinMs = GUESTBOOK_RECENT_MS): boolean {
  const ts = new Date(createdAt).getTime();
  return Number.isFinite(ts) && ts >= Date.now() - withinMs;
}

/** Compact local date/time for chat display, e.g. "8/22/26, 11:16 AM". */
export function formatGuestbookTimestamp(iso: string): string | null {
  const date = new Date(iso);
  const ts = date.getTime();
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function trimEntry(name: string, message: string): { name: string; message: string } {
  return {
    name: name.trim().slice(0, MAX_NAME) || 'Anonymous',
    message: message.trim().slice(0, MAX_MESSAGE),
  };
}

function readLocalEntries(): GuestbookEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestbookEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function getGuestbookLastSeen(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_SEEN_KEY);
}

export function markGuestbookSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
}

function hasUnreadSince(entries: GuestbookEntry[], lastSeen: string | null): boolean {
  if (!lastSeen) {
    return entries.some((entry) => isRecentEntry(entry.createdAt));
  }
  const lastSeenTs = new Date(lastSeen).getTime();
  if (!Number.isFinite(lastSeenTs)) {
    return entries.some((entry) => isRecentEntry(entry.createdAt));
  }
  return entries.some((entry) => {
    const ts = new Date(entry.createdAt).getTime();
    return Number.isFinite(ts) && ts > lastSeenTs;
  });
}

function writeLocalEntries(entries: GuestbookEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

export async function listGuestbookEntries(): Promise<GuestbookEntry[]> {
  if (isFirebaseConfigured) {
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(MAX_ENTRIES),
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<GuestbookEntry, 'id'>),
        }))
        .reverse();
    } catch {
      return readLocalEntries();
    }
  }
  return readLocalEntries();
}

export async function addGuestbookEntry(
  name: string,
  message: string,
): Promise<GuestbookEntry> {
  const { name: trimmedName, message: trimmedMessage } = trimEntry(name, message);
  if (!trimmedMessage) {
    throw new Error('Message cannot be empty.');
  }

  const entry: GuestbookEntry = {
    id: crypto.randomUUID(),
    name: trimmedName,
    message: trimmedMessage,
    createdAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured) {
    try {
      const ref = await addDoc(collection(db, COLLECTION), {
        name: entry.name,
        message: entry.message,
        createdAt: entry.createdAt,
      });
      return { ...entry, id: ref.id };
    } catch {
      // Fall through to localStorage when Firestore rules or network fail.
    }
  }

  const entries = readLocalEntries();
  entries.push(entry);
  writeLocalEntries(entries);
  return entry;
}

/** True when there are guestbook messages the user has not opened since. */
export async function hasUnreadGuestbookMessages(): Promise<boolean> {
  const lastSeen = getGuestbookLastSeen();
  try {
    const entries = await listGuestbookEntries();
    return hasUnreadSince(entries, lastSeen);
  } catch {
    return hasUnreadSince(readLocalEntries(), lastSeen);
  }
}
