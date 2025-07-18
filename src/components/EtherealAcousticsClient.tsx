'use client';

import { useRef, useState } from 'react';
import type { Tone } from 'tone';
import FogVisualizer, {
  type FogVisualizerHandle,
  type Shape,
} from '@/components/FogVisualizer';
import AudioEngine, {
  type AudioEngineHandle,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';

type Layer = {
  id: string;
  shape: Shape;
  synth: Tone.PolySynth | null;
};

export default function EtherealAcousticsClient() {
  const fogVisualizerRef = useRef<FogVisualizerHandle>(null);
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);

  const addSynthLayer = () => {
    if (!audioEngineRef.current || !fogVisualizerRef.current) return;

    const newSynth = audioEngineRef.current.startSynthPad();
    if (!newSynth) return;

    const id = `layer_${Date.now()}`;
    const newShape = fogVisualizerRef.current.addBody(id);

    if (newShape) {
      setLayers((prevLayers) => [
        ...prevLayers,
        { id, shape: newShape, synth: newSynth },
      ]);
    }
  };

  const addFreesoundLayer = () => {
    if (!fogVisualizerRef.current) return;
    const id = `layer_${Date.now()}`;
    fogVisualizerRef.current.addBody(id);
    // We will add Freesound logic here later
  };

  const handleShapeClick = (id: string) => {
    if (!audioEngineRef.current) return;

    const layerToStop = layers.find((layer) => layer.id === id);

    if (layerToStop?.synth) {
      audioEngineRef.current.stopSynth(layerToStop.synth);
    }

    fogVisualizerRef.current?.removeBody(id);
    setLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== id));
  };

  return (
    <div className="relative w-full h-screen">
      <FogVisualizer ref={fogVisualizerRef} onShapeClick={handleShapeClick} />
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