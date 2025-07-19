
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as Tone from 'tone';
import AudioEngine, {
  type AudioEngineHandle,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import LayerCard from '@/components/LayerCard';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Layer = {
  id: string;
  title: string;
  volume: number;
  send: number;
  node: Tone.Player | Tone.Sequence | null;
  type: 'freesound' | 'synth' | 'melodic';
  status: 'loading' | 'loaded';
  position: { x: number; y: number };
  zIndex: number;
  playbackRate?: number;
  progress?: number;
};

type DragState = {
  layerId: string;
  offsetX: number;
  offsetY: number;
} | null;

const MAX_LAYERS = 8;

const adjectives = ['Wandering', 'Cosmic', 'Gentle', 'Fading', 'Shimmering', 'Echoing', 'Distant', 'Lucid', 'Dreamy', 'Ethereal'];
const nouns = ['Pad', 'Drone', 'Melody', 'Echo', 'Texture', 'Chord', 'Arp', 'Fragment', 'Wash', 'Wave'];

const generateRandomName = () => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective} ${noun}`;
};

function DigitalClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // This will only run on the client, after initial hydration
    const timerId = setInterval(() => setTime(new Date()), 1000);
    setTime(new Date());
    return () => clearInterval(timerId);
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div className="font-lcd text-lg text-neutral-800">
      {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
    </div>
  );
}


export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const { toast } = useToast();
  const [dragState, setDragState] = useState<DragState>(null);
  const nextZIndex = useRef(1);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // Cleanup effect to dispose of all audio nodes on component unmount
  useEffect(() => {
    const currentLayers = layers;
    return () => {
      if (audioEngineRef.current) {
        currentLayers.forEach(layer => {
            if (layer.node) {
              if (layer.type === 'freesound') {
                audioEngineRef.current?.stopFreesoundLoop(layer.node as Tone.Player);
              } else if (layer.type === 'melodic') {
                audioEngineRef.current?.stopMelodicLoop(layer.node as Tone.Sequence);
              } else if (layer.type === 'synth') {
                audioEngineRef.current?.stopSynthLoop(layer.node as Tone.Sequence);
              }
            }
        });
        audioEngineRef.current.disposeAll();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // An empty dependency array ensures this runs only on unmount.

  const bringToFront = (id: string) => {
    setLayers(prevLayers => {
      const maxZIndex = Math.max(...prevLayers.map(l => l.zIndex), 0);
      return prevLayers.map(l => 
        l.id === id ? { ...l, zIndex: maxZIndex + 1 } : l
      );
    });
  };

  const addLayer = (
    type: 'synth' | 'freesound' | 'melodic',
    baseProperties: Partial<Layer> = {}
  ) => {
    const id = `layer_${Date.now()}_${Math.random()}`;
    const newLayerStub: Layer = {
      id,
      title: generateRandomName(),
      volume: -12,
      send: -40,
      node: null,
      type: type,
      status: 'loading',
      position: { 
        x: Math.random() * (window.innerWidth / 2),
        y: Math.random() * (window.innerHeight / 4)
      },
      zIndex: nextZIndex.current++,
      ...baseProperties,
    };
    setLayers((prevLayers) => [...prevLayers, newLayerStub]);
    return id;
  };

  const checkLayerLimit = () => {
    if (layers.length >= MAX_LAYERS) {
      toast({
        variant: 'destructive',
        title: 'Layer Limit Reached',
        description: `You can only have a maximum of ${MAX_LAYERS} layers.`,
      });
      return true;
    }
    return false;
  };

  const addSynthLayer = () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('synth', { volume: -12 });
    
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
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('freesound', { volume: -12, playbackRate: 1, progress: 0 });
    
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

    const onProgress = (progress: number) => {
      setLayers(prev => prev.map(l => l.id === id ? { ...l, progress } : l));
    };

    const newPlayer =
      await audioEngineRef.current.startFreesoundLoop(randomSoundUrl, onProgress);
    
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
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('melodic', { volume: -15 });

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
  
  const handleDragStart = (id: string, e: React.MouseEvent) => {
    bringToFront(id);
    const layer = layers.find(l => l.id === id);
    if (!layer) return;

    setDragState({
      layerId: id,
      offsetX: e.clientX - layer.position.x,
      offsetY: e.clientY - layer.position.y,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;

    setLayers(prevLayers =>
      prevLayers.map(l =>
        l.id === dragState.layerId
          ? {
              ...l,
              position: {
                x: e.clientX - dragState.offsetX,
                y: e.clientY - dragState.offsetY,
              },
            }
          : l
      )
    );
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

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

  const handlePlaybackRateChange = (id: string, rate: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node || layer.type !== 'freesound') return;

    audioEngineRef.current.setPlaybackRate(layer.node as Tone.Player, rate);

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, playbackRate: rate } : l))
    );
  };


  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden">
      <AudioEngine ref={audioEngineRef} />

      <main className="flex-grow blueprint-grid relative">
        <div className="absolute top-0 left-0 w-full h-full">
          {layers.map((layer) => (
            <LayerCard
              key={layer.id}
              id={layer.id}
              title={layer.title}
              volume={layer.volume}
              send={layer.send}
              status={layer.status}
              type={layer.type}
              position={layer.position}
              zIndex={layer.zIndex}
              playbackRate={layer.playbackRate}
              progress={layer.progress}
              onRemove={handleRemoveLayer}
              onVolumeChange={handleVolumeChange}
              onSendChange={handleSendChange}
              onPlaybackRateChange={handlePlaybackRateChange}
              onMouseDown={(e) => handleDragStart(layer.id, e)}
            />
          ))}
          {layers.length === 0 && !isAlertDismissed && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans">
                <div className="bg-blue-800 text-white flex items-center p-1">
                  <span className="font-bold text-sm select-none">Ethereal Acoustics</span>
                </div>
                <div className="p-4 flex flex-col items-center gap-4 text-black">
                    <div className="flex items-start gap-4 self-stretch">
                        <Info className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        <div>
                            <p>Your canvas is empty.</p>
                            <p>Click the "Start" button to add a sound layer.</p>
                        </div>
                    </div>
                    <Button
                        variant="retro"
                        className="px-8"
                        onClick={() => setIsAlertDismissed(true)}
                    >
                        OK
                    </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <footer className="w-full h-10 bg-silver border-t-2 border-t-white flex items-center px-2 z-20">
         <SoundscapeController
            onAddSynthLayer={addSynthLayer}
            onAddFreesoundLayer={addFreesoundLayer}
            onAddMelodicLayer={addMelodicLayer}
            canAddLayer={layers.length < MAX_LAYERS}
          />
          <div className="flex-grow" />
          <div className="bg-silver border-2 border-r-white border-b-white border-l-neutral-500 border-t-neutral-500 px-2 py-0.5">
             <DigitalClock />
          </div>
      </footer>
    </div>
  );
}
