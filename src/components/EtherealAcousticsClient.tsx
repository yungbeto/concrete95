
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as Tone from 'tone';
import sillyname from 'sillyname';
import AudioEngine, {
  type AudioEngineHandle,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import LayerCard from '@/components/LayerCard';
import { Info, Music, Waves, Zap, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DesktopIcon from './DesktopIcon';
import InfoWindow from './InfoWindow';
import TaskbarItem from './TaskbarItem';

type Layer = {
  id: string;
  title: string;
  volume: number;
  send: number;
  node: Tone.Player | Tone.Sequence | null;
  type: 'freesound' | 'synth' | 'melodic';
  status: 'loading' | 'playing' | 'stopped';
  position: { x: number; y: number };
  zIndex: number;
  playbackRate?: number;
};

type WindowState = {
  id: string;
  title: string;
  content: React.ReactNode;
  isOpen: boolean;
  position: { x: number; y: number };
  zIndex: number;
};

type DragState = {
  id: string;
  type: 'layer' | 'window';
  offsetX: number;
  offsetY: number;
} | null;

const MAX_LAYERS = 8;

const generateRandomName = () => {
    const name = sillyname();
    return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

function DigitalClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    setTime(new Date());
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="font-lcd text-lg text-neutral-800">
      {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
    </div>
  );
}

const layerIcons: { [key in Layer['type']]: LucideIcon } = {
  synth: Zap,
  freesound: Waves,
  melodic: Music,
};

export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const { toast } = useToast();
  const [dragState, setDragState] = useState<DragState>(null);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'about',
      title: 'About Concrete 95',
      content: (
        <div className="text-black space-y-2 text-sm">
          <p>
            Welcome to Concrete 95, your personal AI-driven soundscape
            generator.
          </p>
          <p>
            Create rich, evolving audio environments by layering synth pads,
            melodic loops, and unique sounds from Freesound.org. Drag and drop
            layers, tweak their properties, and let the AI surprise you.
          </p>
          <p>Built with Next.js, Tone.js, and Genkit.</p>
        </div>
      ),
      isOpen: false,
      position: { x: 250, y: 150 },
      zIndex: 1,
    },
  ]);

  const allItems = [...layers, ...windows.filter(w => w.isOpen)];
  const maxZIndex = Math.max(...allItems.map(item => item.zIndex), 0);
  const activeItemId = allItems.find(item => item.zIndex === maxZIndex)?.id;


  useEffect(() => {
    const currentAudioEngine = audioEngineRef.current;
    const currentLayers = layers;
    return () => {
      if (currentAudioEngine) {
        currentLayers.forEach(layer => {
            if (layer.node) {
              if (layer.type === 'freesound') {
                currentAudioEngine.stopFreesoundLoop(layer.node as Tone.Player);
              } else if (layer.type === 'melodic') {
                currentAudioEngine.stopMelodicLoop(layer.node as Tone.Sequence);
              } else if (layer.type === 'synth') {
                currentAudioEngine.stopSynthLoop(layer.node as Tone.Sequence);
              }
            }
        });
        currentAudioEngine.disposeAll();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bringToFront = (id: string, type: 'layer' | 'window') => {
    const currentMaxZ = Math.max(...layers.map(l => l.zIndex), ...windows.map(w => w.zIndex), 0);

    if (type === 'layer') {
      setLayers(prev => prev.map(l => l.id === id ? { ...l, zIndex: currentMaxZ + 1 } : l));
    } else {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: currentMaxZ + 1 } : w));
    }
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
      zIndex: maxZIndex + 1,
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

  const addSynthLayer = () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('synth', { volume: -12 });

    const newSynthLoop = audioEngineRef.current.startSynthLoop();
    if (!newSynthLoop) {
      handleRemoveLayer(id);
      return;
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newSynthLoop, status: 'playing' } : l
      )
    );
  };

  const addFreesoundLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('freesound', { volume: -12, playbackRate: 1 });

    const soundUrls = await searchFreesound('');

    if ('error' in soundUrls || soundUrls.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: 'error' in soundUrls ? soundUrls.error : `No sounds found.`,
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

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newPlayer, status: 'playing' } : l
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

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newSequence, status: 'playing' } : l
      )
    );
  };

  const handleDragStart = (id: string, type: 'layer' | 'window', e: React.MouseEvent) => {
    bringToFront(id, type);
    const item = type === 'layer' ? layers.find(l => l.id === id) : windows.find(w => w.id === id);
    if (!item) return;

    setDragState({
      id: id,
      type,
      offsetX: e.clientX - item.position.x,
      offsetY: e.clientY - item.position.y,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;

    const moveItem = (items: any[]) => {
      return items.map(item =>
        item.id === dragState.id
          ? {
              ...item,
              position: {
                x: e.clientX - dragState.offsetX,
                y: e.clientY - dragState.offsetY,
              },
            }
          : item
      );
    };

    if (dragState.type === 'layer') {
      setLayers(moveItem);
    } else {
      setWindows(moveItem);
    }
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

  const handleRemoveAllLayers = () => {
    if (!audioEngineRef.current) return;
    layers.forEach(layer => {
      if (layer.node) {
        if (layer.type === 'freesound') {
          audioEngineRef.current!.stopFreesoundLoop(layer.node as Tone.Player);
        } else if (layer.type === 'melodic') {
          audioEngineRef.current!.stopMelodicLoop(layer.node as Tone.Sequence);
        } else if (layer.type === 'synth') {
          audioEngineRef.current!.stopSynthLoop(layer.node as Tone.Sequence);
        }
      }
    });
    setLayers([]);
  };

  const openWindow = (id: string) => {
    bringToFront(id, 'window');
    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, isOpen: true } : w))
    );
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.map(w => (w.id === id ? { ...w, isOpen: false } : w)));
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
        <div className="absolute top-0 left-0 w-full h-full p-4">
          <DesktopIcon
            icon={Info}
            label="About This App"
            onDoubleClick={() => openWindow('about')}
          />
        </div>
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
              audioEngineRef={audioEngineRef}
              node={layer.node}
              onRemove={handleRemoveLayer}
              onVolumeChange={handleVolumeChange}
              onSendChange={handleSendChange}
              onPlaybackRateChange={handlePlaybackRateChange}
              onMouseDown={(e) => handleDragStart(layer.id, 'layer', e)}
            />
          ))}
          {windows.map(win =>
            win.isOpen ? (
              <InfoWindow
                key={win.id}
                title={win.title}
                position={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onMouseDown={(e) => handleDragStart(win.id, 'window', e)}
              >
                {win.content}
              </InfoWindow>
            ) : null
          )}
          {layers.length === 0 && !isAlertDismissed && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans">
                <div className="bg-blue-800 text-white flex items-center p-1">
                  <span className="font-bold text-sm select-none">Concrete 95</span>
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
      
      <footer className="w-full h-10 bg-silver border-t-2 border-t-white flex items-center px-2 z-20 shrink-0">
         <SoundscapeController
            onAddSynthLayer={addSynthLayer}
            onAddFreesoundLayer={addFreesoundLayer}
            onAddMelodicLayer={addMelodicLayer}
            onStopAll={handleRemoveAllLayers}
            canAddLayer={layers.length < MAX_LAYERS}
            hasLayers={layers.length > 0}
          />
          <div className="flex-grow flex items-center gap-1 mx-1 overflow-hidden">
            {windows.filter(w => w.isOpen).map(win => (
                <TaskbarItem 
                    key={win.id}
                    icon={Info}
                    label={win.title}
                    isActive={activeItemId === win.id}
                    onClick={() => bringToFront(win.id, 'window')}
                />
            ))}
            {layers.map(layer => (
                <TaskbarItem 
                    key={layer.id}
                    icon={layerIcons[layer.type]}
                    label={layer.title}
                    isActive={activeItemId === layer.id}
                    onClick={() => bringToFront(layer.id, 'layer')}
                />
            ))}
          </div>
          <div className="bg-silver border-2 border-r-white border-b-white border-l-neutral-500 border-t-neutral-500 px-2 h-8 flex items-center shrink-0">
             <DigitalClock />
          </div>
      </footer>
    </div>
  );
}
