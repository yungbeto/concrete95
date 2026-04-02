// Firestore security rules to deploy in Firebase Console → Firestore → Rules:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /users/{userId}/sessions/{sessionId} {
//       allow read, write, delete: if request.auth != null && request.auth.uid == userId;
//     }
//   }
// }

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Normalize env strings. Must use `process.env.NEXT_PUBLIC_…` directly so Next inlines values
 * in the client bundle.
 *
 * Strips BOM, quotes, and trailing `,`/ `;` — common when pasting from `firebaseConfig` JSON
 * (a stray comma breaks `projectId` and shows up as `…/projects/ethereal-acoustics,/…` in Network).
 */
function trimEnv(raw: string | undefined): string | undefined {
  if (raw == null || raw === '') return undefined;
  let v = raw.replace(/^\uFEFF/, '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/^[,;\s]+|[,;\s]+$/g, '').trim();
  return v || undefined;
}

if (process.env.NODE_ENV === 'development') {
  const k = trimEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  if (k && (!k.startsWith('AIza') || k.length < 35)) {
    console.warn(
      '[firebase] NEXT_PUBLIC_FIREBASE_API_KEY should be the Web API key from Firebase → Project settings (typically ~39 chars, starts with AIza). Check for typos or using a non-Firebase key.'
    );
  }
}

const firebaseConfig = {
  apiKey: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: trimEnv(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

// Guard: don't initialise if the API key is missing (e.g. env vars not yet set).
// Components that need Firebase should check `isFirebaseConfigured` before using auth/db.
export const isFirebaseConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

/** Trimmed measurement ID (same normalization as `firebaseConfig`). */
export const firebaseWebMeasurementId = firebaseConfig.measurementId;

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (isFirebaseConfigured) {
  _app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  _auth = getAuth(_app);
  _db = getFirestore(_app);
}

// Non-null assertions: callers should only access these after checking isFirebaseConfigured
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const auth = _auth!;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const db = _db!;

export default _app;
