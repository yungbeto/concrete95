
'use client';

import { useRef, useState, useEffect } from 'react';
import * as Tone from 'tone';
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
  send: number;
  node: Tone.Player | Tone.Sequence | null;
  type: 'freesound' | 'synth' | 'melodic';
  status: 'loading' | 'loaded';
};

const adjectives = ['Wandering', 'Cosmic', 'Gentle', 'Fading', 'Shimmering', 'Echoing', 'Distant', 'Lucid', 'Dreamy', 'Ethereal'];
const nouns = ['Pad', 'Drone', 'Melody', 'Echo', 'Texture', 'Chord', 'Arp', 'Fragment', 'Wash', 'Wave'];

const generateRandomName = () => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective} ${noun}`;
};

function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="font-lcd text-lg text-neutral-800">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}


export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const { toast } = useToast();

  const addSynthLayer = () => {
    if (!audioEngineRef.current) return;

    const id = `layer_${Date.now()}_${Math.random()}`;
    const newLayerStub: Layer = {
      id,
      title: generateRandomName(),
      volume: -12,
      send: -40,
      node: null,
      type: 'synth',
      status: 'loading',
    };
    setLayers((prevLayers) => [...prevLayers, newLayerStub]);

    const newSynthLoop = audioEngineRef.current.startSynthLoop();
    if (!newSynthLoop) {
      handleRemoveLayer(id);
      return;
    }
    
    audioEngineRef.current.playNode(newSynthLoop);

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newSynthLoop, status: 'loaded' } : l
      )
    );
  };

  const addFreesoundLayer = async () => {
    if (!audioEngineRef.current) return;

    const id = `layer_${Date.now()}_${Math.random()}`;
    const newLayerStub: Layer = {
      id,
      title: generateRandomName(),
      volume: -12,
      send: -40,
      node: null,
      type: 'freesound',
      status: 'loading',
    };
    setLayers((prevLayers) => [...prevLayers, newLayerStub]);
    
    const queries = ['ambient', 'drone', 'texture', 'pad', 'atmosphere'];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];

    const soundUrls = await searchFreesound(randomQuery);

    if ('error' in soundUrls || soundUrls.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: 'error' in soundUrls ? soundUrls.error : `No sounds found for query: "${randomQuery}"`,
      });
      handleRemoveLayer(id);
      return;
    }
    
    const randomSoundUrl =
      soundUrls[Math.floor(Math.random() * soundUrls.length)];

    const newPlayer =
      await audioEngineRef.current.startFreesoundLoop(randomSoundUrl);
    
    if (!newPlayer) {
      handleRemoveLayer(id);
      return;
    }

    audioEngineRef.current.playNode(newPlayer);
    
    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newPlayer, status: 'loaded' } : l
      )
    );
  };

    const addMelodicLayer = () => {
    if (!audioEngineRef.current) return;
    
    const id = `layer_${Date.now()}_${Math.random()}`;
    const newLayerStub: Layer = {
      id,
      title: generateRandomName(),
      volume: -15,
      send: -40,
      node: null,
      type: 'melodic',
      status: 'loading',
    };
    setLayers((prevLayers) => [...prevLayers, newLayerStub]);

    const newSequence = audioEngineRef.current.startMelodicLoop();
    if (!newSequence) {
      handleRemoveLayer(id);
      return;
    }

    audioEngineRef.current.playNode(newSequence);

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newSequence, status: 'loaded' } : l
      )
    );
  };

  const handleRemoveLayer = (id: string) => {
    if (!audioEngineRef.current) return;
    const layerToRemove = layers.find((l) => l.id === id);
    if (!layerToRemove) return;

    if (layerToRemove.node) {
      if (layerToRemove.type === 'freesound') {
        audioEngineRef.current.stopFreesoundLoop(layerToRemove.node as Tone.Player);
      } else if (layerToRemove.type === 'melodic') {
        audioEngineRef.current.stopMelodicLoop(layerToRemove.node as Tone.Sequence);
      } else if (layerToRemove.type === 'synth') {
        audioEngineRef.current.stopSynthLoop(layerToRemove.node as Tone.Sequence);
      }
    }

    setLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== id));
  };
  
  const handleVolumeChange = (id: string, volume: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;

    audioEngineRef.current.setVolume(layer.node, volume);

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, volume } : l))
    );
  };
  
  const handleSendChange = (id: string, send: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;

    audioEngineRef.current.setSendAmount(layer.node, send);

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, send } : l))
    );
  };


  return (
    <div className="relative w-full h-screen flex flex-col">
      <AudioEngine ref={audioEngineRef} />

      <main className="flex-grow blueprint-grid relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {layers.map((layer) => (
              <LayerCard
                key={layer.id}
                id={layer.id}
                title={layer.title}
                volume={layer.volume}
                send={layer.send}
                status={layer.status}
                type={layer.type}
                onRemove={handleRemoveLayer}
                onVolumeChange={handleVolumeChange}
                onSendChange={handleSendChange}
              />
            ))}
            {layers.length === 0 && (
              <div className="text-center text-muted-foreground p-8 bg-black/50 rounded-lg">
                <p>Your canvas is empty.</p>
                <p>Click the "Start" button to add a sound layer.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="w-full h-10 bg-silver border-t-2 border-t-white flex items-center px-2 z-20">
         <SoundscapeController
            onAddSynthLayer={addSynthLayer}
            onAddFreesoundLayer={addFreesoundLayer}
            onAddMelodicLayer={addMelodicLayer}
            isReady={true}
          />
          <div className="flex-grow" />
          <div className="bg-silver border-2 border-r-white border-b-white border-l-neutral-500 border-t-neutral-500 px-2 py-0.5">
             <DigitalClock />
          </div>
      </footer>
    </div>
  );
}
