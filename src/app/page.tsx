'use client';

import { useState, useSyncExternalStore } from 'react';
import EtherealAcousticsClient from '@/components/client/EtherealAcousticsClient';
import BootScreen from '@/components/BootScreen';

const INTRO_SEEN_KEY = 'concrete95:introSeen';

function subscribeToIntroSeen() {
  return () => {};
}

function getIntroSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    document.documentElement.dataset.introSeen = '1';
  } catch {
    // Ignore quota / private-mode failures; the intro will replay this session.
  }
}

export default function Home() {
  const introSeen = useSyncExternalStore(
    subscribeToIntroSeen,
    getIntroSeen,
    () => false,
  );
  const [completedIntro, setCompletedIntro] = useState(false);
  const booted = introSeen || completedIntro;

  return (
    <main className="min-h-screen w-full">
      <EtherealAcousticsClient booted={booted} />
      {!booted && (
        <BootScreen
          onComplete={() => {
            markIntroSeen();
            setCompletedIntro(true);
          }}
        />
      )}
    </main>
  );
}
