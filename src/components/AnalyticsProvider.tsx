
'use client';

import { useEffect } from 'react';
import { getAnalytics, isSupported } from 'firebase/analytics';
import app, { firebaseWebMeasurementId, isFirebaseConfigured } from '@/lib/firebase';

export default function AnalyticsProvider() {
  useEffect(() => {
    const init = async () => {
      if (typeof window === 'undefined') return;
      if (!isFirebaseConfigured || app == null) return;
      if (!firebaseWebMeasurementId) return;

      const supported = await isSupported();
      if (!supported) return;

      // Check the app's own options rather than relying solely on the env export,
      // so we never call getAnalytics when measurementId is absent or the app is stale.
      const measurementId = (app.options as Record<string, unknown>).measurementId;
      if (!measurementId) return;

      try {
        getAnalytics(app);
      } catch (e) {
        console.warn('[Analytics] init skipped:', e);
      }
    };
    void init();
  }, []);

  return null;
}
