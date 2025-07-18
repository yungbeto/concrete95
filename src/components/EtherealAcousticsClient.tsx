
'use client';

import { useRef, useState, useEffect } from 'react';
import type { PolySynth, Player } from 'tone';
import FogVisualizer, {
  type FogVisualizerHandle,
} from '@/components/FogVisualizer';
import AudioEngine, {
  type AudioEngineHandle,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import type { Shape } from '@/lib/types';

type Layer = {
  id: string;
  shape: Shape;
  synth?: PolySynth;
  player?: Player;
};

export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const { toast } = useToast();

  const createShape = (id: string): Shape | null => {
    if (!canvasSize) return null;

    const { width, height } = canvasSize;
    if (width === 0 || height === 0) return null;

    const radius = Math.random() * 20 + 20;
    const x = Math.random() * (width - radius * 2) + radius;
    const y = Math.random() * (height - radius * 2) + radius;
    const colors = ['#fc79bc', '#fcec79', '#fafafa'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return { id, x, y, radius, color: randomColor };
  };

  const addSynthLayer = () => {
    if (!audioEngineRef.current) return;

    const newSynth = audioEngineRef.current.startSynthPad();
    if (!newSynth) return;

    const id = `layer_${Date.now()}`;
    const newShape = createShape(id);

    if (newShape) {
      setLayers((prevLayers) => [
        ...prevLayers,
        { id, shape: newShape, synth: newSynth },
      ]);
    }
  };

  const addFreesoundLayer = async () => {
    if (!audioEngineRef.current) return;

    const queries = ['ambient', 'drone', 'texture', 'pad', 'atmosphere'];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];

    const soundUrls = await searchFreesound(randomQuery);

    if ('error' in soundUrls) {
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: soundUrls.error,
      });
      return;
    }

    if (soundUrls.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: `No sounds found for query: "${randomQuery}"`,
      });
      return;
    }

    const randomSoundUrl =
      soundUrls[Math.floor(Math.random() * soundUrls.length)];

    const newPlayer =
      await audioEngineRef.current.startFreesoundLoop(randomSoundUrl);
    if (!newPlayer) return;

    const id = `layer_${Date.now()}`;
    const newShape = createShape(id);

    if (newShape) {
      setLayers((prevLayers) => [
        ...prevLayers,
        { id, shape: newShape, player: newPlayer },
      ]);
    }
  };

  const handleShapeClick = (id: string) => {
    if (!audioEngineRef.current) return;

    const layerToStop = layers.find((layer) => layer.id === id);

    if (layerToStop?.synth) {
      audioEngineRef.current.stopSynth(layerToStop.synth);
    }

    if (layerToStop?.player) {
      audioEngineRef.current.stopFreesoundLoop(layerToStop.player);
    }

    setLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== id));
  };

  return (
    <div className="relative w-full h-screen">
      <FogVisualizer
        layers={layers}
        onShapeClick={handleShapeClick}
        onReady={setCanvasSize}
      />
      <AudioEngine ref={audioEngineRef} />
      <header className="absolute top-0 left-0 p-4 md:p-8 z-10">
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
        isReady={!!canvasSize}
      />
    </div>
  );
}
