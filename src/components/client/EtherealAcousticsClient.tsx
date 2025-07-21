
'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import * as Tone from 'tone';
import AudioEngine, {
  type AudioEngineHandle,
  type FreesoundLayerInfo,
  type SynthLayerInfo,
  type ScaleName,
  scaleNames,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound, type FreesoundSound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import LayerCard from '@/components/LayerCard';
import { Info, Music, Settings, Waves, Zap, type LucideIcon, Speaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DesktopIcon from '../DesktopIcon';
import InfoWindow from '../InfoWindow';
import TaskbarItem from '../TaskbarItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import Fieldset from '../Fieldset';
import { Slider } from '../ui/slider';
import { useIsMobile } from '@/hooks/use-mobile';

type LayerInfo = FreesoundLayerInfo | SynthLayerInfo;

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
  info?: LayerInfo;
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
const DESKTOP_ICON_Z_INDEX = 10;

const adjectives = ["Whispering", "Crimson", "Silent", "Wandering", "Golden", "Frozen", "Electric", "Forgotten", "Dreaming", "Floating", "Luminous", "Distant", "Hollow", "Fading", "Shimmering", "Pulsating", "Drifting", "Cosmic", "Spectral", "Resonant", "Astral", "Veiled", "Lucid", "Starlit", "Subtle", "Ripe", "Green", "Crisp", "Igneous", "Sedimentary", "Volcanic", "Crystalline", "Granite", "Legal", "Binding", "Judicial", "Provisional", "Statutory", "Cumulus", "Turbulent", "Arctic", "Tropical", "Liquid", "Bullish", "Bearish", "Fiscal", "Solvent", "Crude", "Refined", "Synthetic", "Offshore", "Bituminous", "Quartz", "Feldspar", "Calcite", "Metallic", "Galactic", "Interstellar", "Orbital", "Planetary", "Nebular", "Oblique", "Parallel", "Tangential", "Ephemeral", "Perpetual", "Quantum", "Stochastic", "Fractal", "Chaotic", "Harmonic", "Digital", "Analog", "Virtual", "Augmented", "Gaseous", "Molten", "Subterranean", "Abyssal"];
const nouns = ["Echo", "Void", "Mirage", "Nexus", "Nebula", "Tide", "Signal", "Cipher", "Ghost", "Fragment", "Pulse", "Resonance", "Drift", "Particle", "Stardust", "Hum", "Frequency", "Vibration", "Glimmer", "Wave", "Artifact", "Oracle", "Monolith", "Chime", "Whisper", "Apple", "Quarry", "Theorem", "Monsoon", "Dividend", "Wellhead", "Geode", "Comet", "Deposition", "Hurricane", "Option", "Pipeline", "Fossil", "Asteroid", "Subpoena", "Tornado", "Derivative", "Shale", "Bedrock", "Ionosphere", "Meteor", "Garnishment", "Futures", "Aquifer", "Permafrost", "Indictment", "Stratus", "Bankruptcy", "Obsidian", "Quasar", "Tundra", "Arbitrage", "Conduit", "Basalt", "Exosphere", "Lawsuit", "Cyclone", "Barometer", "Mortgage", "Prospect", "Pulsar"];


const generateRandomName = () => {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
};


function DigitalClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    setTime(new Date());
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="font-lcd text-md text-neutral-800">
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
  const [globalScale, setGlobalScale] = useState<ScaleName>('major');
  const [delayFeedback, setDelayFeedback] = useState(0.6);
  const [reverbDecay, setReverbDecay] = useState(10);
  const [globalBPM, setGlobalBPM] = useState(120);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isEngineInitialized, setIsEngineInitialized] = useState(false);
  const isMobile = useIsMobile();


  useEffect(() => {
    if (audioEngineRef.current && !isMobile) {
        setGlobalBPM(audioEngineRef.current.getBPM());
        setIsEngineInitialized(true);
    }
  }, [isMobile]);


  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'about',
      title: 'About Concrete 95',
      content: (
        <div className="text-black space-y-2 text-sm">
          <p>
            Welcome to Concrete 95, a tool for random audio explorations. All audio from Freesound.org and Tone.js. 
          </p>
          <p>
            This app was built by <a href="http://robysaavedra.com" target="_blank" rel="noopener noreferrer" className="cursor-pointer text-blue-600 underline hover:text-blue-700">
            Roby Saavedra</a>.
          </p>
          <p>
            Last updated: July 21, 2025
          </p>
        </div>
      ),
      isOpen: false,
      position: { x: 250, y: 150 },
      zIndex: 1,
    },
    {
        id: 'settings',
        title: 'Global Settings',
        content: (
          <div className="text-black space-y-4 text-sm">
             {/* This content is dynamically generated */}
          </div>
        ),
        isOpen: false,
        position: { x: 300, y: 200 },
        zIndex: 1,
      },
  ]);

  const allItems = [...layers, ...windows.filter(w => w.isOpen)];
  const maxZIndex = Math.max(DESKTOP_ICON_Z_INDEX, ...allItems.map(item => item.zIndex), 0);
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
    const currentMaxZ = Math.max(DESKTOP_ICON_Z_INDEX, ...layers.map(l => l.zIndex), ...windows.map(w => w.zIndex), 0);

    if (type === 'layer') {
      setLayers(prev => prev.map(l => l.id === id ? { ...l, zIndex: currentMaxZ + 1 } : l));
    } else {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: currentMaxZ + 1 } : w));
    }
  };
  
  const getNewLayerPosition = () => {
    if (isMobile) {
        const x = (window.innerWidth / 2) - 160; 
        const y = 80 + layers.length * 40;
        return { x, y };
    }
    return {
        x: Math.random() * (window.innerWidth / 2),
        y: Math.random() * (window.innerHeight / 4)
    };
  };

  const getNewWindowPosition = () => {
    if (isMobile) {
        const x = (window.innerWidth / 2) - 160;
        const y = 100;
        return {x, y};
    }
    const openWindows = windows.filter(w => w.isOpen);
    return {
        x: 250 + openWindows.length * 20,
        y: 150 + openWindows.length * 20
    }
  }


  const addLayer = (
    type: 'synth' | 'freesound' | 'melodic',
    baseProperties: Partial<Layer> = {}
  ) => {
    if (!isEngineInitialized) {
        return;
    }
    const id = `layer_${Date.now()}_${Math.random()}`;
    const newLayerStub: Layer = {
      id,
      title: generateRandomName(),
      volume: -12,
      send: -40,
      node: null,
      type: type,
      status: 'loading',
      position: getNewLayerPosition(),
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
    const id = addLayer('synth', { volume: -18 });
    if (!id) return;

    const newSynthData = audioEngineRef.current.startSynthLoop(globalScale);
    if (!newSynthData) {
      handleRemoveLayer(id);
      return;
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newSynthData.sequence, info: newSynthData.info, status: 'playing' } : l
      )
    );
  };

  const addFreesoundLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('freesound', { volume: -12, playbackRate: 1 });
    if (!id) return;

    const sounds = await searchFreesound('');

    if ('error' in sounds || sounds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: 'error' in sounds ? sounds.error : `No sounds found.`,
      });
      handleRemoveLayer(id);
      return;
    }

    const randomSound =
      sounds[Math.floor(Math.random() * sounds.length)];


    const newPlayerData =
      await audioEngineRef.current.startFreesoundLoop(randomSound);

    if (!newPlayerData) {
      handleRemoveLayer(id);
      return;
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newPlayerData.player, info: newPlayerData.info, status: 'playing' } : l
      )
    );
  };

  const addMelodicLayer = () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('melodic', { volume: -18 });
    if (!id) return;

    const newMelodicData = audioEngineRef.current.startMelodicLoop(globalScale);
    if (!newMelodicData) {
      handleRemoveLayer(id);
      return;
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id ? { ...l, node: newMelodicData.sequence, info: newMelodicData.info, status: 'playing' } : l
      )
    );
  };

  const handleDragStart = (id: string, type: 'layer' | 'window', e: React.MouseEvent | React.TouchEvent) => {
    bringToFront(id, type);
    let item;
    if (type === 'layer') {
        item = layers.find(l => l.id === id);
    } else {
        item = windows.find(w => w.id === id);
    }
  
    if (!item) return;
  
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
    setDragState({
      id: id,
      type,
      offsetX: clientX - item.position.x,
      offsetY: clientY - item.position.y,
    });
  };
  
  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragState) return;
  
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
    const moveItem = (items: any[]) => {
      return items.map(item =>
        item.id === dragState.id
          ? {
              ...item,
              position: {
                x: clientX - dragState.offsetX,
                y: clientY - dragState.offsetY,
              },
            }
          : item
      );
    };
  
    if (dragState.type === 'layer') {
      setLayers(prev => moveItem(prev));
    } else {
      setWindows(prev => moveItem(prev));
    }
  }, [dragState]);
  
  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);
  
  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    }
  
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);
  

  const handleScaleChange = (value: string) => {
    setGlobalScale(value as ScaleName);
  };

  const handleDelayFeedbackChange = (value: number) => {
    setDelayFeedback(value);
    audioEngineRef.current?.setDelayFeedback(value);
  };

  const handleReverbDecayChange = (value: number) => {
    setReverbDecay(value);
    audioEngineRef.current?.setReverbDecay(value);
  };

  const handleBPMChange = (value: number) => {
    setGlobalBPM(value);
    audioEngineRef.current?.setBPM(value);
  }

  useEffect(() => {
    const newSettingsContent = (
      <div className="text-black space-y-4 text-sm">
        <Fieldset label="Musical Scale">
            <p className="text-xs mb-2">Set the musical scale for all new synth and melodic layers.</p>
            <Select value={globalScale} onValueChange={handleScaleChange}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a scale" />
            </SelectTrigger>
            <SelectContent>
                {scaleNames.map(name => (
                <SelectItem key={name} value={name}>
                    {name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
            {layers.length > 0 && (
                <Fieldset label="Warning" variant="warning" className="mt-4">
                    <p className="text-xs">
                        Changing the scale only affects new layers. For a consistent soundscape, please Stop All layers and start fresh.
                    </p>
                </Fieldset>
            )}
        </Fieldset>

        <Fieldset label="Master Tempo">
            <p className="text-xs mb-2">BPM: {globalBPM.toFixed(0)}</p>
            <Slider
                defaultValue={[globalBPM]}
                max={180}
                min={40}
                step={1}
                onValueChange={(value) => handleBPMChange(value[0])}
            />
        </Fieldset>

        <Fieldset label="Master Delay">
            <p className="text-xs mb-2">Feedback: {delayFeedback.toFixed(2)}</p>
            <Slider
                defaultValue={[delayFeedback]}
                max={0.95}
                min={0}
                step={0.01}
                onValueChange={(value) => handleDelayFeedbackChange(value[0])}
            />
        </Fieldset>

        <Fieldset label="Master Reverb">
            <p className="text-xs mb-2">Decay: {reverbDecay.toFixed(1)}s</p>
            <Slider
                defaultValue={[reverbDecay]}
                max={20}
                min={0.5}
                step={0.1}
                onValueChange={(value) => handleReverbDecayChange(value[0])}
            />
        </Fieldset>
      </div>
    );
    setWindows(prev => prev.map(w => w.id === 'settings' ? { ...w, content: newSettingsContent } : w));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalScale, layers.length, delayFeedback, reverbDecay, globalBPM]);

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
      prev.map(w => (w.id === id ? { ...w, isOpen: true, position: getNewWindowPosition() } : w))
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
  
  const handleStartAudio = async () => {
    await Tone.start();
    if (audioEngineRef.current) {
        audioEngineRef.current.initialize();
        setGlobalBPM(audioEngineRef.current.getBPM());
        setIsEngineInitialized(true);
    }
    setIsAudioReady(true);
  };

  return (
    <div className="relative w-full h-dvh flex flex-col overflow-hidden">
      <AudioEngine ref={audioEngineRef} isMobile={isMobile} />

      {isMobile && !isAudioReady && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans">
                <div className="bg-blue-800 text-white flex items-center p-1">
                  <span className="font-bold text-sm select-none">Audio Permission</span>
                </div>
                <div className="p-4 flex flex-col items-center gap-4 text-black">
                    <div className="flex items-start gap-4 self-stretch">
                        <Speaker className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        <div>
                            <p>This experience requires audio. Please click the button below to enable it.</p>
                        </div>
                    </div>
                    <Button
                        variant="retro"
                        className="px-8"
                        onClick={handleStartAudio}
                    >
                        Enable Audio
                    </Button>
                </div>
              </div>
        </div>
      )}

      <main className="flex-grow blueprint-grid relative">
        <div className="absolute top-4 left-4 flex gap-2" style={{zIndex: DESKTOP_ICON_Z_INDEX}}>
            <DesktopIcon
                imageUrl="/concreteicon.png"
                label="Readme.info"
                onClick={() => openWindow('about')}
            />
             <DesktopIcon
                imageUrl="/cog.png"
                label="Settings.exe"
                onClick={() => openWindow('settings')}
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
              info={layer.info}
              onRemove={handleRemoveLayer}
              onVolumeChange={handleVolumeChange}
              onSendChange={handleSendChange}
              onPlaybackRateChange={handlePlaybackRateChange}
              onMouseDown={(e) => handleDragStart(layer.id, 'layer', e)}
              onTouchStart={(e) => handleDragStart(layer.id, 'layer', e)}
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
                onTouchStart={(e) => handleDragStart(win.id, 'window', e)}
              >
                {win.content}
              </InfoWindow>
            ) : null
          )}
          {layers.length === 0 && !isAlertDismissed && isEngineInitialized && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans">
                <div className="bg-blue-800 text-white flex items-center p-1">
                  <span className="font-bold text-sm select-none">Welcome to Concrete 95!</span>
                </div>
                <div className="p-4 flex flex-col items-center gap-4 text-black">
                    <div className="flex items-start gap-4 self-stretch">
                        <Info className="w-8 h-8 text-blue-600 flex-shrink-0" />
                        <div>

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
            canAddLayer={layers.length < MAX_LAYERS && isEngineInitialized}
            hasLayers={layers.length > 0}
          />
          <div className="flex-grow flex items-center gap-1 mx-1 overflow-hidden h-full">
            {windows.filter(w => w.isOpen).map(win => (
                <TaskbarItem
                    key={win.id}
                    icon={win.id === 'about' ? Info : Settings}
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
