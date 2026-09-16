#!/usr/bin/env node
/**
 * Refreshes the `freesound_pool` Firestore collection — a cache of vetted
 * Freesound results the app falls back to when the live Freesound API is
 * unreachable from the server's egress IP (see src/actions/freesound.ts).
 *
 * Run this from a machine with working, unblocked network access to
 * freesound.org (i.e. not the deployed Cloud Function). Needs:
 *   - FREESOUND_API_KEY in .env.local
 *   - `gcloud auth application-default login` run once, for Firestore admin access
 *
 * Usage: npm run freesound:refresh-pool
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(projectRoot, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        // Mirrors src/lib/firebase.ts's trimEnv — .env.local values pasted from the
        // firebaseConfig JSON snippet often carry a stray trailing comma/semicolon.
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1).trim();
        }
        value = value.replace(/^[,;\s]+|[,;\s]+$/g, '').trim();
        process.env[match[1]] = value;
      }
    }
  } catch {
    // .env.local optional if vars are already in the environment
  }
}

loadEnvLocal();

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ethereal-acoustics';
const FREESOUND_API_KEY = process.env.FREESOUND_API_KEY;
const MIN_DURATION_SECONDS = 8;
const MAX_DURATION_SECONDS = 120;
const PAGES_TO_FETCH = 6;
const PAGE_SIZE = 50;
const POOL_CAP = 600;

const DEFAULT_BLOCKED_FREESOUND_USERS = ['looplicator', 'CAT-FOX_ALEX'];
const BLOCKED_FREESOUND_USERS = new Set(
  DEFAULT_BLOCKED_FREESOUND_USERS.map((n) => n.trim().toLowerCase()).concat(
    (process.env.FREESOUND_BLOCKED_USERS ?? '')
      .split(',')
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean),
  ),
);

if (!FREESOUND_API_KEY) {
  console.error('FREESOUND_API_KEY is not set (checked process.env and .env.local).');
  process.exit(1);
}

async function fetchPage(page) {
  const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(
    '',
  )}&filter=duration:[${MIN_DURATION_SECONDS}%20TO%20${MAX_DURATION_SECONDS}]%20license:"Creative%20Commons%200"&fields=id,name,previews,username&sort=created_desc&page_size=${PAGE_SIZE}&page=${page}&token=${FREESOUND_API_KEY}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'concrete95-pool-refresh/1.0 (+https://concrete95.net)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Freesound page ${page} failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

async function main() {
  console.log(`Fetching up to ${PAGES_TO_FETCH * PAGE_SIZE} candidates from Freesound...`);

  const byId = new Map();
  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    let results;
    try {
      results = await fetchPage(page);
    } catch (err) {
      console.warn(`  page ${page}: ${err.message}`);
      continue;
    }
    for (const sound of results) {
      const username = typeof sound.username === 'string' ? sound.username.trim().toLowerCase() : '';
      if (BLOCKED_FREESOUND_USERS.has(username)) continue;
      const previewUrl = sound.previews?.['preview-lq-mp3'] || sound.previews?.['preview-hq-mp3'];
      if (!previewUrl) continue;
      byId.set(String(sound.id), {
        id: sound.id,
        name: sound.name,
        previewUrl,
        username: sound.username ?? '',
      });
    }
    console.log(`  page ${page}: ${results.length} results, ${byId.size} unique so far`);
  }

  if (byId.size === 0) {
    console.error('No sounds fetched — aborting without touching Firestore.');
    process.exit(1);
  }

  console.log(`Writing ${byId.size} sounds to Firestore project "${PROJECT_ID}"...`);

  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const db = getFirestore();
  const collectionRef = db.collection('freesound_pool');

  const entries = [...byId.values()].slice(0, POOL_CAP);
  const BATCH_SIZE = 400;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const entry of entries.slice(i, i + BATCH_SIZE)) {
      batch.set(collectionRef.doc(String(entry.id)), {
        ...entry,
        refreshedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`  committed ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}`);
  }

  console.log(`Done. Pool now has ${entries.length} sounds (capped at ${POOL_CAP}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
