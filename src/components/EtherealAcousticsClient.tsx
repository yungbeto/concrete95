'use client';

import SoundscapeController from '@/components/SoundscapeController';

export default function EtherealAcousticsClient() {
  return (
    <div className="w-full max-w-4xl">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Ethereal Acoustics
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Craft your own ambient soundscape.
        </p>
      </header>
      <main>
        <SoundscapeController />
      </main>
    </div>
  );
}
