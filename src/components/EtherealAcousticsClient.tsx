'use client';

import FogVisualizer from '@/components/FogVisualizer';
import SoundscapeController from '@/components/SoundscapeController';

export default function EtherealAcousticsClient() {
  return (
    <div className="relative w-full h-screen">
      <FogVisualizer />
      <header className="absolute top-0 left-0 p-4 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ethereal Acoustics
        </h1>
        <p className="mt-2 text-lg leading-8 text-muted-foreground">
          Design your soundscape.
        </p>
      </header>
      <SoundscapeController />
    </div>
  );
}
