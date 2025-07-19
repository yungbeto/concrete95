
'use client';

import { useRef, useState } from 'react';
import { Player, Sequence } from 'tone';
import type { PolySynth } from 'tone';
import AudioEngine, {
  type AudioEngineHandle,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import LayerCard from '@/components/LayerCard';

type Layer = {
  id: string;
  title: string;
  volume: number;
  node: PolySynth | Player | Sequence;
};

export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const { toast } = useToast();

  const addSynthLayer = () => {
    if (!audioEngineRef.current) return;

    const newSynth = audioEngineRef.current.startSynthPad();
    if (!newSynth) return;

    const id = `layer_${Date.now()}`;
    const newLayer: Layer = {
      id,
      title: 'Synth Pad',
      volume: 0,
      node: newSynth,
    };
    setLayers((prevLayers) => [...prevLayers, newLayer]);
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
    const newLayer: Layer = {
      id,
      title: 'Freesound Loop',
      volume: 0,
      node: newPlayer,
    };

    setLayers((prevLayers) => [...prevLayers, newLayer]);
  };

    const addMelodicLayer = () => {
    if (!audioEngineRef.current) return;

    const newSequence = audioEngineRef.current.startMelodicLoop();
    if (!newSequence) return;

    const id = `layer_${Date.now()}`;
    const newLayer: Layer = {
      id,
      title: 'Melodic Loop',
      volume: 0,
      node: newSequence,
    };
    setLayers((prevLayers) => [...prevLayers, newLayer]);
  };

  const handleRemoveLayer = (id: string) => {
    if (!audioEngineRef.current) return;
    const layerToRemove = layers.find((l) => l.id === id);
    if (!layerToRemove) return;

    if (layerToRemove.node instanceof Player) {
      audioEngineRef.current.stopFreesoundLoop(layerToRemove.node);
    } else if (layerToRemove.node instanceof Sequence) {
      audioEngineRef.current.stopMelodicLoop(layerToRemove.node);
    }
    else {
      audioEngineRef.current.stopSynth(layerToRemove.node as PolySynth);
    }

    setLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== id));
  };
  
  const handleVolumeChange = (id: string, volume: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;

    const synth = (layer.node as any).synth;
    if (synth) {
       audioEngineRef.current.setVolume(synth, volume);
    } else {
       audioEngineRef.current.setVolume(layer.node, volume);
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, volume } : l))
    );
  };

  return (
    <div className="relative w-full h-screen">
      <AudioEngine ref={audioEngineRef} />
      <header className="absolute top-0 left-0 p-4 md:p-8 z-10">
        <h1 className="text-l font-bold tracking-tight text-foreground sm:text-4xl">
          Ethereal Acoustics
        </h1>
        <p className="mt-2 text-md leading-8 text-muted-foreground">
          Design your soundscape by adding layers.
        </p>
      </header>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-4">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {layers.map((layer) => (
            <LayerCard
              key={layer.id}
              id={layer.id}
              title={layer.title}
              volume={layer.volume}
              onRemove={handleRemoveLayer}
              onVolumeChange={handleVolumeChange}
            />
          ))}
          {layers.length === 0 && (
             <div className="text-center text-muted-foreground">
               <p>Your canvas is empty.</p>
               <p>Click the plus button to add a sound layer.</p>
             </div>
          )}
        </div>
      </div>
      
      <SoundscapeController
        onAddSynthLayer={addSynthLayer}
        onAddFreesoundLayer={addFreesoundLayer}
        onAddMelodicLayer={addMelodicLayer}
        isReady={true}
      />
    </div>
  );
}
