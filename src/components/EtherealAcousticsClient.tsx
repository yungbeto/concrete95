'use client';

import { useRef } from 'react';
import FogVisualizer, { FogVisualizerHandle } from '@/components/FogVisualizer';
import AudioEngine, { AudioEngineHandle } from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';

export default function EtherealAcousticsClient() {
  const fogVisualizerRef = useRef<FogVisualizerHandle>(null);
  const audioEngineRef = useRef<AudioEngineHandle>(null);

  const addSynthLayer = () => {
    fogVisualizerRef.current?.addBody();
    audioEngineRef.current?.playSynthPad();
  };

  const addFreesoundLayer = () => {
    fogVisualizerRef.current?.addBody();
    // We will add Freesound logic here later
  };

  return (
    <div className="relative w-full h-screen">
      <FogVisualizer ref={fogVisualizerRef} />
      <AudioEngine ref={audioEngineRef} />
      <header className="absolute top-0 left-0 p-4 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
          Ethereal Acoustics
        </h1>
        <p className="mt-2 text-lg leading-8 text-muted-foreground">
          Design your soundscape.
        </p>
      </header>
      <SoundscapeController
        onAddSynthLayer={addSynthLayer}
        onAddFreesoundLayer={addFreesoundLayer}
      />
    </div>
  );
}
