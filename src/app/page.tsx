'use client';

import { useState } from 'react';
import EtherealAcousticsClient from '@/components/client/EtherealAcousticsClient';
import BootScreen from '@/components/BootScreen';

export default function Home() {
  const [booted, setBooted] = useState(false);

  return (
    <main className="min-h-screen w-full">
      <EtherealAcousticsClient booted={booted} />
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}
    </main>
  );
}
