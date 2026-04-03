'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import AudioEngine, {
  type AudioEngineHandle,
  type FreesoundLayerInfo,
  type GrainLayerInfo,
  type SynthLayerInfo,
  type ScaleName,
  scaleNames,
  delayTimeOptions,
  type DelayTime,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound, type FreesoundSound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import LayerCard from '@/components/LayerCard';
import VUMeter from '@/components/VUMeter';
import {
  Info,
  Music,
  Settings,
  Waves,
  Zap,
  type LucideIcon,
  Speaker,
  SlidersHorizontal,
  Cpu,
  Activity,
  Share2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DesktopIcon from '../DesktopIcon';
import InfoWindow from '../InfoWindow';
import TaskbarItem from '../TaskbarItem';
import LissajousWindow from '../LissajousWindow';
import SessionsAuthModal from '../SessionsAuthModal';
import RecordingExportDialog from '../RecordingExportDialog';
import MidiClockPanel from '../MidiClockPanel';
import SharePanel from '../SharePanel';
import AboutConcrete95Body from '../AboutConcrete95Body';
import { useMidiClock } from '@/hooks/use-midi-clock';
import { useAuth } from '@/hooks/use-auth';
import {
  buildSession,
  type SavedGlobalSettings,
  type SavedSession,
  saveUserSession,
} from '@/lib/sessions';
import { createRng, randomSeed, parseSeed } from '@/lib/prng';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import Fieldset from '../Fieldset';
import { Slider } from '../ui/slider';
import { useIsMobile } from '@/hooks/use-mobile';

type LayerInfo = FreesoundLayerInfo | GrainLayerInfo | SynthLayerInfo;

type Layer = {
  id: string;
  title: string;
  volume: number;
  send: number;
  node: Tone.Player | Tone.GrainPlayer | Tone.Sequence | null;
  type: 'freesound' | 'grain' | 'synth' | 'melodic';
  status: 'loading' | 'playing' | 'stopped';
  position: { x: number; y: number };
  zIndex: number;
  playbackRate?: number;
  reverse?: boolean;
  info?: LayerInfo;
  filterCutoff?: number;
  filterResonance?: number;
  probability?: number;
  grainSize?: number;
  grainDrift?: number;
};

type WindowState = {
  id: string;
  title: string;
  icon: LucideIcon;
  content: React.ReactNode | null;
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

const adjectives = [
  'Whispering',
  'Crimson',
  'Silent',
  'Wandering',
  'Golden',
  'Frozen',
  'Electric',
  'Forgotten',
  'Dreaming',
  'Floating',
  'Luminous',
  'Distant',
  'Hollow',
  'Fading',
  'Shimmering',
  'Pulsating',
  'Drifting',
  'Cosmic',
  'Spectral',
  'Resonant',
  'Astral',
  'Veiled',
  'Lucid',
  'Starlit',
  'Subtle',
  'Ripe',
  'Green',
  'Crisp',
  'Igneous',
  'Sedimentary',
  'Volcanic',
  'Crystalline',
  'Granite',
  'Legal',
  'Binding',
  'Judicial',
  'Provisional',
  'Statutory',
  'Cumulus',
  'Turbulent',
  'Arctic',
  'Tropical',
  'Liquid',
  'Bullish',
  'Bearish',
  'Fiscal',
  'Solvent',
  'Crude',
  'Refined',
  'Synthetic',
  'Offshore',
  'Bituminous',
  'Quartz',
  'Feldspar',
  'Calcite',
  'Metallic',
  'Galactic',
  'Interstellar',
  'Orbital',
  'Planetary',
  'Nebular',
  'Oblique',
  'Parallel',
  'Tangential',
  'Ephemeral',
  'Perpetual',
  'Quantum',
  'Stochastic',
  'Fractal',
  'Chaotic',
  'Harmonic',
  'Digital',
  'Analog',
  'Virtual',
  'Augmented',
  'Gaseous',
  'Molten',
  'Subterranean',
  'Abyssal',
];
const nouns = [
  'Echo',
  'Void',
  'Mirage',
  'Nexus',
  'Nebula',
  'Tide',
  'Signal',
  'Cipher',
  'Ghost',
  'Fragment',
  'Pulse',
  'Resonance',
  'Drift',
  'Particle',
  'Stardust',
  'Hum',
  'Frequency',
  'Vibration',
  'Glimmer',
  'Wave',
  'Artifact',
  'Oracle',
  'Monolith',
  'Chime',
  'Whisper',
  'Apple',
  'Quarry',
  'Theorem',
  'Monsoon',
  'Dividend',
  'Wellhead',
  'Geode',
  'Comet',
  'Deposition',
  'Hurricane',
  'Option',
  'Pipeline',
  'Fossil',
  'Asteroid',
  'Subpoena',
  'Tornado',
  'Derivative',
  'Shale',
  'Bedrock',
  'Ionosphere',
  'Meteor',
  'Garnishment',
  'Futures',
  'Aquifer',
  'Permafrost',
  'Indictment',
  'Stratus',
  'Bankruptcy',
  'Obsidian',
  'Quasar',
  'Tundra',
  'Arbitrage',
  'Conduit',
  'Basalt',
  'Exosphere',
  'Lawsuit',
  'Cyclone',
  'Barometer',
  'Mortgage',
  'Prospect',
  'Pulsar',
];

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
    <div className='text-xs text-neutral-800'>
      {time
        ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '00:00'}
    </div>
  );
}

const layerIcons: { [key in Layer['type']]: LucideIcon } = {
  synth: Zap,
  freesound: Waves,
  grain: Sparkles,
  melodic: Music,
};

export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const { toast } = useToast();
  const [dragState, setDragState] = useState<DragState>(null);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [globalScale, setGlobalScale] = useState<ScaleName>('major');
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [delayTime, setDelayTime] = useState<DelayTime>('4n');
  const [delayCutoff, setDelayCutoff] = useState(5000);
  const [reverbDecay, setReverbDecay] = useState(10);
  const [reverbWet, setReverbWet] = useState(0.7);
  const [reverbDiffusion, setReverbDiffusion] = useState(0.7);
  const [warmth, setWarmth] = useState(0);
  const [breatheEnabled, setBreatheEnabled] = useState(false);
  const [breathePeriod, setBreathePeriod] = useState(4);
  const [discreetMode, setDiscreetMode] = useState(false);
  const [driftEnabled, setDriftEnabled] = useState(false);
  const [driftPeriod, setDriftPeriod] = useState(10);
  const [globalBPM, setGlobalBPM] = useState(120);
  const isMobile = useIsMobile();
  const [isAudioReady, setIsAudioReady] = useState(isMobile);
  const [isEngineInitialized, setIsEngineInitialized] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const [sessionsAuthOpen, setSessionsAuthOpen] = useState(false);

  // ── Recording ──────────────────────────────────────────────────────────────
  const MAX_RECORDING_SECONDS = 10 * 60;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxRecordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Ref mirrors recordingSeconds so autoStop timeout reads current value
  const recordingSecondsRef = useRef(0);

  // Export dialog state
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportDuration, setExportDuration] = useState(0);

  // ── Seed / PRNG ───────────────────────────────────────────────────────────
  const [displaySeed, setDisplaySeed] = useState<number | null>(null);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const sessionSeedRef = useRef<number | null>(null);

  // Read seed from URL on mount
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('seed');
    const seed = parseSeed(raw);
    if (seed != null) {
      sessionSeedRef.current = seed;
      setDisplaySeed(seed);
    }
  }, []);

  const applySeed = useCallback((seed: number) => {
    sessionSeedRef.current = seed;
    setDisplaySeed(seed);
    audioEngineRef.current?.setRng(createRng(seed));
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    window.history.replaceState(null, '', url.toString());
  }, []);

  const clearSeed = useCallback(() => {
    sessionSeedRef.current = null;
    setDisplaySeed(null);
    audioEngineRef.current?.setRng(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('seed');
    window.history.replaceState(null, '', url.toString());
  }, []);

  // ── MIDI Clock Slave ───────────────────────────────────────────────────────
  const [midiPanelOpen, setMidiPanelOpen] = useState(false);

  const handleMidiBpmChange = useCallback((bpm: number) => {
    setGlobalBPM(bpm);
    audioEngineRef.current?.setBPM(bpm);
  }, []);

  const [midiDiodeLit, setMidiDiodeLit] = useState(false);

  const {
    isSupported: midiSupported,
    ports: midiPorts,
    selectedPortId: midiPortId,
    setSelectedPortId: setMidiPortId,
    isReceiving: midiReceiving,
    syncedBpm: midiSyncedBpm,
    beatCount: midiBeatCount,
  } = useMidiClock(handleMidiBpmChange);

  // Flash the MIDI diode briefly on each beat; extinguish immediately when not receiving
  useEffect(() => {
    if (!midiReceiving) {
      setMidiDiodeLit(false);
      return;
    }
    setMidiDiodeLit(true);
    const t = setTimeout(() => setMidiDiodeLit(false), 80);
    return () => clearTimeout(t);
  }, [midiBeatCount, midiReceiving]);

  const stopAndCollect = async (autoStopped = false) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
      maxRecordingTimerRef.current = null;
    }
    const duration = recordingSecondsRef.current;
    setIsRecording(false);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    if (!audioEngineRef.current) return;
    const blob = await audioEngineRef.current.stopRecording();
    if (blob.size === 0) {
      toast({ variant: 'destructive', title: 'Recording was empty' });
      return;
    }
    // Pause master output while user reviews the export dialog
    audioEngineRef.current.setMasterMute(true);
    setExportDuration(duration);
    setExportBlob(blob);
    if (autoStopped) {
      toast({
        title: 'Recording stopped',
        description: 'Maximum length (10 min) reached.',
      });
    }
  };

  const handleStartRecording = async () => {
    if (!audioEngineRef.current || !isEngineInitialized) return;
    try {
      await audioEngineRef.current.startRecording();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Recording failed',
        description: String(err),
      });
      return;
    }
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        recordingSecondsRef.current = s + 1;
        return s + 1;
      });
    }, 1000);
    maxRecordingTimerRef.current = setTimeout(() => {
      void stopAndCollect(true);
    }, MAX_RECORDING_SECONDS * 1000);
  };

  const handleStopRecording = () => void stopAndCollect(false);

  const handleExportDownload = (name: string) => {
    if (!exportBlob) return;
    const t = exportBlob.type.toLowerCase();
    const ext =
      t.includes('mp4') || t.includes('aac')
        ? 'm4a'
        : t.includes('ogg')
          ? 'ogg'
          : 'webm';
    const url = URL.createObjectURL(exportBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.trim() || 'concrete95'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    handleExportClose();
  };

  const handleExportClose = () => {
    setExportBlob(null);
    audioEngineRef.current?.setMasterMute(false);
  };

  // ── Active session + dirty tracking ───────────────────────────────────────
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);
  const [isSessionDirty, setIsSessionDirty] = useState(false);
  // Set to true before any programmatic state change (load, save) that should
  // NOT be treated as a user edit. The effect clears it after skipping once.
  const skipNextDirtyRef = useRef(false);

  useEffect(() => {
    if (!activeSession) return;
    if (skipNextDirtyRef.current) {
      skipNextDirtyRef.current = false;
      return;
    }
    setIsSessionDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSession,
    layers,
    globalScale,
    discreetMode,
    driftEnabled,
    driftPeriod,
    globalBPM,
    warmth,
    breatheEnabled,
    breathePeriod,
    delayFeedback,
    delayTime,
    delayCutoff,
    reverbDecay,
    reverbWet,
    reverbDiffusion,
  ]);

  useEffect(() => {
    if (audioEngineRef.current && !isMobile) {
      setGlobalBPM(audioEngineRef.current.getBPM());
      setIsEngineInitialized(true);
      const seed = sessionSeedRef.current ?? randomSeed();
      applySeed(seed);
    }
  }, [isMobile, applySeed]);

  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'about',
      title: 'About Concrete 95',
      icon: Info,
      content: null,
      isOpen: false,
      position: { x: 250, y: 150 },
      zIndex: 1,
    },
    {
      id: 'settings',
      title: 'Global Settings',
      icon: Settings,
      content: (
        <div className='text-black space-y-4 text-sm'>
          {/* This content is dynamically generated */}
        </div>
      ),
      isOpen: false,
      position: { x: 300, y: 200 },
      zIndex: 1,
    },
    {
      id: 'fxbus',
      title: 'FX Send Bus',
      icon: SlidersHorizontal,
      content: (
        <div className='text-black space-y-4 text-sm'>
          {/* This content is dynamically generated */}
        </div>
      ),
      isOpen: false,
      position: { x: 350, y: 250 },
      zIndex: 1,
    },
    {
      id: 'master',
      title: 'MasterFX.exe',
      icon: Cpu,
      content: (
        <div className='text-black space-y-4 text-sm'>
          {/* This content is dynamically generated */}
        </div>
      ),
      isOpen: false,
      position: { x: 400, y: 300 },
      zIndex: 1,
    },
    {
      id: 'scope',
      title: 'Scope.exe',
      icon: Activity,
      content: null,
      isOpen: false,
      position: { x: 450, y: 150 },
      zIndex: 1,
    },
  ]);

  const allItems = [...layers, ...windows.filter((w) => w.isOpen)];
  const maxZIndex = Math.max(
    DESKTOP_ICON_Z_INDEX,
    ...allItems.map((item) => item.zIndex),
    0,
  );
  const activeItemId = allItems.find((item) => item.zIndex === maxZIndex)?.id;

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (maxRecordingTimerRef.current)
        clearTimeout(maxRecordingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const currentAudioEngine = audioEngineRef.current;
    const currentLayers = layers;
    return () => {
      if (currentAudioEngine) {
        currentLayers.forEach((layer) => {
          if (layer.node) {
            if (layer.type === 'freesound') {
              currentAudioEngine.stopFreesoundLoop(layer.node as Tone.Player);
            } else if (layer.type === 'grain') {
              currentAudioEngine.stopGrainLoop(layer.node as Tone.GrainPlayer);
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
    const currentMaxZ = Math.max(
      DESKTOP_ICON_Z_INDEX,
      ...layers.map((l) => l.zIndex),
      ...windows.map((w) => w.zIndex),
      0,
    );

    if (type === 'layer') {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, zIndex: currentMaxZ + 1 } : l)),
      );
    } else {
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, zIndex: currentMaxZ + 1 } : w)),
      );
    }
  };

  const getNewLayerPosition = (index?: number) => {
    if (isMobile) {
      const count = index ?? layers.length;
      const x = Math.max(0, window.innerWidth / 2 - 160);
      const y = Math.min(80 + count * 40, window.innerHeight - 280);
      return { x, y };
    }
    return {
      x: Math.random() * (window.innerWidth / 2),
      y: Math.random() * (window.innerHeight / 4),
    };
  };

  const getNewWindowPosition = () => {
    if (isMobile) {
      const x = window.innerWidth / 2 - 160;
      const y = 100;
      return { x, y };
    }
    const openWindows = windows.filter((w) => w.isOpen);
    return {
      x: 250 + openWindows.length * 20,
      y: 150 + openWindows.length * 20,
    };
  };

  const addLayer = (
    type: 'synth' | 'freesound' | 'grain' | 'melodic',
    baseProperties: Partial<Layer> = {},
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
        audioEngineRef.current.stopFreesoundLoop(
          layerToRemove.node as Tone.Player,
        );
      } else if (layerToRemove.type === 'grain') {
        audioEngineRef.current.stopGrainLoop(
          layerToRemove.node as Tone.GrainPlayer,
        );
      } else if (layerToRemove.type === 'melodic') {
        audioEngineRef.current.stopMelodicLoop(
          layerToRemove.node as Tone.Sequence,
        );
      } else if (layerToRemove.type === 'synth') {
        audioEngineRef.current.stopSynthLoop(
          layerToRemove.node as Tone.Sequence,
        );
      }
    }

    setLayers((prevLayers) => prevLayers.filter((layer) => layer.id !== id));
  };

  const addSynthLayer = () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('synth', { volume: -18 });
    if (!id) return;

    const newSynthData = audioEngineRef.current.startSynthLoop(
      globalScale,
      discreetMode,
    );
    if (!newSynthData) {
      handleRemoveLayer(id);
      return;
    }

    if (driftEnabled) {
      audioEngineRef.current.setLayerDrift(
        newSynthData.sequence,
        true,
        driftPeriod,
      );
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id
          ? {
              ...l,
              node: newSynthData.sequence,
              info: newSynthData.info,
              status: 'playing',
              filterCutoff: newSynthData.filterCutoff,
              filterResonance: newSynthData.filterResonance,
            }
          : l,
      ),
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

    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];

    const newPlayerData =
      await audioEngineRef.current.startFreesoundLoop(randomSound);

    if (!newPlayerData) {
      handleRemoveLayer(id);
      return;
    }

    if (driftEnabled) {
      audioEngineRef.current.setLayerDrift(
        newPlayerData.player,
        true,
        driftPeriod,
      );
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id
          ? {
              ...l,
              node: newPlayerData.player,
              info: newPlayerData.info,
              status: 'playing',
              filterCutoff: newPlayerData.filterCutoff,
              filterResonance: newPlayerData.filterResonance,
            }
          : l,
      ),
    );
  };

  const addGrainLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('grain', {
      volume: -12,
      playbackRate: 1,
      grainSize: 0.1,
      grainDrift: 0.04,
    });
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

    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];

    const newGrainData =
      await audioEngineRef.current.startGrainLoop(randomSound);

    if (!newGrainData) {
      handleRemoveLayer(id);
      return;
    }

    if (driftEnabled) {
      audioEngineRef.current.setLayerDrift(
        newGrainData.player,
        true,
        driftPeriod,
      );
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id
          ? {
              ...l,
              node: newGrainData.player,
              info: newGrainData.info,
              status: 'playing',
              filterCutoff: newGrainData.filterCutoff,
              filterResonance: newGrainData.filterResonance,
              grainSize: newGrainData.grainSize,
              grainDrift: newGrainData.grainDrift,
            }
          : l,
      ),
    );
  };

  const addMelodicLayer = () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    const id = addLayer('melodic', { volume: -18 });
    if (!id) return;

    const newMelodicData = audioEngineRef.current.startMelodicLoop(
      globalScale,
      discreetMode,
    );
    if (!newMelodicData) {
      handleRemoveLayer(id);
      return;
    }

    if (driftEnabled) {
      audioEngineRef.current.setLayerDrift(
        newMelodicData.sequence,
        true,
        driftPeriod,
      );
    }

    setLayers((prevLayers) =>
      prevLayers.map((l) =>
        l.id === id
          ? {
              ...l,
              node: newMelodicData.sequence,
              info: newMelodicData.info,
              status: 'playing',
              filterCutoff: newMelodicData.filterCutoff,
              filterResonance: newMelodicData.filterResonance,
            }
          : l,
      ),
    );
  };

  const handleDragStart = (
    id: string,
    type: 'layer' | 'window',
    e: React.MouseEvent | React.TouchEvent,
  ) => {
    bringToFront(id, type);
    let item;
    if (type === 'layer') {
      item = layers.find((l) => l.id === id);
    } else {
      item = windows.find((w) => w.id === id);
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

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!dragState) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const moveItem = (items: any[]) => {
        return items.map((item) =>
          item.id === dragState.id
            ? {
                ...item,
                position: {
                  x: clientX - dragState.offsetX,
                  y: clientY - dragState.offsetY,
                },
              }
            : item,
        );
      };

      if (dragState.type === 'layer') {
        setLayers((prev) => moveItem(prev));
      } else {
        setWindows((prev) => moveItem(prev));
      }
    },
    [dragState],
  );

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

  const handleDelayTimeChange = (value: string) => {
    const newDelayTime = value as DelayTime;
    setDelayTime(newDelayTime);
    audioEngineRef.current?.setDelayTime(newDelayTime);
  };

  const handleDelayCutoffChange = (value: number) => {
    setDelayCutoff(value);
    audioEngineRef.current?.setDelayCutoff(value);
  };

  const handleReverbDecayChange = (value: number) => {
    setReverbDecay(value);
    audioEngineRef.current?.setReverbDecay(value);
  };

  const handleReverbWetChange = (value: number) => {
    setReverbWet(value);
    audioEngineRef.current?.setReverbWet(value);
  };

  const handleReverbDiffusionChange = (value: number) => {
    setReverbDiffusion(value);
    audioEngineRef.current?.setReverbDiffusion(value);
  };

  const handleWarmthChange = (value: number) => {
    setWarmth(value);
    audioEngineRef.current?.setWarmth(value);
  };

  const handleBreatheToggle = (enabled: boolean) => {
    setBreatheEnabled(enabled);
    audioEngineRef.current?.setBreatheEnabled(enabled, breathePeriod);
  };

  const handleBreathePeriodChange = (value: number) => {
    setBreathePeriod(value);
    if (breatheEnabled) {
      audioEngineRef.current?.setBreatheEnabled(true, value);
    }
  };

  const handleBPMChange = (value: number) => {
    setGlobalBPM(value);
    audioEngineRef.current?.setBPM(value);
  };

  const settingsWindowContent = useMemo(
    () => (
      <div className='text-black space-y-4 text-sm'>
        <Fieldset label='Musical Scale'>
          <p className='text-xs mb-2'>
            Set the musical scale for all new synth and melodic layers.
          </p>
          <Select value={globalScale} onValueChange={handleScaleChange}>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select a scale' />
            </SelectTrigger>
            <SelectContent>
              {scaleNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name.charAt(0).toUpperCase() +
                    name.slice(1).replace(/([A-Z])/g, ' $1')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {layers.length > 0 && (
            <Fieldset label='Warning' variant='warning' className='mt-4'>
              <p className='text-xs'>
                Changing the scale only affects new layers. For a consistent
                soundscape, please Stop All layers and start fresh.
              </p>
            </Fieldset>
          )}
        </Fieldset>

        <Fieldset label='Master Tempo'>
          <p className='text-xs mb-2'>
            BPM: {globalBPM.toFixed(0)}
            {midiReceiving && (
              <span className='ml-2 text-neutral-500 italic'>
                MIDI sync active
              </span>
            )}
          </p>
          <Slider
            value={[globalBPM]}
            max={180}
            min={40}
            step={1}
            disabled={midiReceiving}
            onValueChange={(value) => handleBPMChange(value[0])}
          />
        </Fieldset>

        <Fieldset label='Parameter Drift'>
          <button
            role='checkbox'
            aria-checked={driftEnabled}
            onClick={() => handleDriftToggle(!driftEnabled)}
            className='flex items-center gap-2 cursor-pointer select-none'
          >
            <span className='w-3.5 h-3.5 flex-shrink-0 border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white flex items-center justify-center'>
              {driftEnabled && (
                <span
                  className='text-black leading-none'
                  style={{ fontSize: '9px', marginTop: '-1px' }}
                >
                  ✓
                </span>
              )}
            </span>
            <span className='text-xs'>Enable Parameter Drift</span>
          </button>
          <p className='text-xs mt-4 mb-2'>
            Period: {driftPeriod.toFixed(0)} min
          </p>
          <Slider
            defaultValue={[driftPeriod]}
            max={30}
            min={5}
            step={1}
            onValueChange={(value) => handleDriftPeriodChange(value[0])}
          />
          <p className='text-xs mt-2 text-neutral-700'>
            Each layer&apos;s volume slowly rises and falls at its own pace —
            sounds drift in and out of focus over time.
          </p>
        </Fieldset>

        <Fieldset label='Discreet Music Mode'>
          <button
            role='checkbox'
            aria-checked={discreetMode}
            onClick={() => setDiscreetMode((v) => !v)}
            className='flex items-center gap-2 cursor-pointer select-none'
          >
            <span className='w-3.5 h-3.5 flex-shrink-0 border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white flex items-center justify-center'>
              {discreetMode && (
                <span
                  className='text-black leading-none'
                  style={{ fontSize: '9px', marginTop: '-1px' }}
                >
                  ✓
                </span>
              )}
            </span>
            <span className='text-xs'>Enable Discreet Music Mode</span>
          </button>
          <p className='text-xs mt-2 text-neutral-700'>
            New synth and melodic layers get prime-length loops (5, 7, 11, 13…
            measures) so they never re-align — inspired by Eno&apos;s tape-loop
            phase technique on <em>Discreet Music</em>.
          </p>
        </Fieldset>
      </div>
    ),
    [
      globalScale,
      layers.length,
      discreetMode,
      driftEnabled,
      driftPeriod,
      globalBPM,
      midiReceiving,
    ],
  );

  const fxBusWindowContent = useMemo(
    () => (
      <div className='text-black space-y-4 text-sm'>
        <Fieldset label='Master Delay'>
          <p className='text-xs mb-2'>Time</p>
          <Select value={delayTime} onValueChange={handleDelayTimeChange}>
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select a time' />
            </SelectTrigger>
            <SelectContent>
              {delayTimeOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className='text-xs mt-4 mb-2'>
            Feedback: {delayFeedback.toFixed(2)}
          </p>
          <Slider
            defaultValue={[delayFeedback]}
            max={0.95}
            min={0}
            step={0.01}
            onValueChange={(value) => handleDelayFeedbackChange(value[0])}
          />
          <p className='text-xs mt-4 mb-2'>
            Hi-Cut: {(delayCutoff / 1000).toFixed(1)} kHz
          </p>
          <Slider
            defaultValue={[delayCutoff]}
            max={20000}
            min={500}
            step={100}
            onValueChange={(value) => handleDelayCutoffChange(value[0])}
          />
        </Fieldset>

        <Fieldset label='Master Reverb'>
          <p className='text-xs mb-2'>Decay: {reverbDecay.toFixed(1)}s</p>
          <Slider
            defaultValue={[reverbDecay]}
            max={20}
            min={0.5}
            step={0.1}
            onValueChange={(value) => handleReverbDecayChange(value[0])}
          />
          <p className='text-xs mt-4 mb-2'>Wet/Dry: {reverbWet.toFixed(2)}</p>
          <Slider
            defaultValue={[reverbWet]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={(value) => handleReverbWetChange(value[0])}
          />
          <p className='text-xs mt-4 mb-2'>
            Diffusion: {reverbDiffusion.toFixed(2)}
          </p>
          <Slider
            defaultValue={[reverbDiffusion]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={(value) => handleReverbDiffusionChange(value[0])}
          />
        </Fieldset>
      </div>
    ),
    [
      delayFeedback,
      delayTime,
      delayCutoff,
      reverbDecay,
      reverbWet,
      reverbDiffusion,
    ],
  );

  const masterWindowContent = useMemo(
    () => (
      <div className='text-black space-y-4 text-sm'>
        <Fieldset label='Tape Warmth'>
          <p className='text-xs mb-2'>Warmth: {warmth.toFixed(2)}</p>
          <Slider
            defaultValue={[warmth]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={(value) => handleWarmthChange(value[0])}
          />
          <p className='text-xs mt-2 text-neutral-700'>
            Subtle harmonic saturation on the master output. Start low — a
            little goes a long way.
          </p>
        </Fieldset>

        <Fieldset label='Breathe'>
          <button
            role='checkbox'
            aria-checked={breatheEnabled}
            onClick={() => handleBreatheToggle(!breatheEnabled)}
            className='flex items-center gap-2 cursor-pointer select-none'
          >
            <span className='w-3.5 h-3.5 flex-shrink-0 border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white flex items-center justify-center'>
              {breatheEnabled && (
                <span
                  className='text-black leading-none'
                  style={{ fontSize: '9px', marginTop: '-1px' }}
                >
                  ✓
                </span>
              )}
            </span>
            <span className='text-xs'>Enable Breathe</span>
          </button>
          <p className='text-xs mt-4 mb-2'>
            Period: {breathePeriod.toFixed(0)} min
          </p>
          <Slider
            defaultValue={[breathePeriod]}
            max={8}
            min={2}
            step={0.5}
            onValueChange={(value) => handleBreathePeriodChange(value[0])}
          />
          <p className='text-xs mt-2 text-neutral-700'>
            Slowly rises and falls over the selected period — the piece inhales
            and exhales.
          </p>
        </Fieldset>
      </div>
    ),
    [warmth, breatheEnabled, breathePeriod],
  );

  useEffect(() => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id === 'settings')
          return { ...w, content: settingsWindowContent };
        if (w.id === 'fxbus') return { ...w, content: fxBusWindowContent };
        if (w.id === 'master') return { ...w, content: masterWindowContent };
        return w;
      }),
    );
  }, [settingsWindowContent, fxBusWindowContent, masterWindowContent]);

  const handleRemoveAllLayers = () => {
    if (!audioEngineRef.current) return;
    layers.forEach((layer) => {
      if (layer.node) {
        if (layer.type === 'freesound') {
          audioEngineRef.current!.stopFreesoundLoop(layer.node as Tone.Player);
        } else if (layer.type === 'grain') {
          audioEngineRef.current!.stopGrainLoop(layer.node as Tone.GrainPlayer);
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
    setWindows((prev) => {
      const currentMaxZ = Math.max(
        DESKTOP_ICON_Z_INDEX,
        ...prev.map((w) => w.zIndex),
        ...layers.map((l) => l.zIndex),
      );
      const isOpen = prev.find((w) => w.id === id)?.isOpen;
      if (isOpen) {
        return prev.map((w) =>
          w.id === id ? { ...w, zIndex: currentMaxZ + 1 } : w,
        );
      }
      return prev.map((w) =>
        w.id === id
          ? {
              ...w,
              isOpen: true,
              position: getNewWindowPosition(),
              zIndex: currentMaxZ + 1,
            }
          : w,
      );
    });
  };

  const closeWindow = (id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isOpen: false } : w)),
    );
  };

  const handleVolumeChange = (id: string, volume: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;

    audioEngineRef.current.setVolume(layer.node, volume);

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, volume } : l)),
    );
  };

  const handleSendChange = (id: string, send: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;

    audioEngineRef.current.setSendAmount(layer.node, send);

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, send } : l)),
    );
  };

  const handlePlaybackRateChange = (id: string, rate: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (
      !layer ||
      !layer.node ||
      (layer.type !== 'freesound' && layer.type !== 'grain')
    )
      return;

    audioEngineRef.current.setPlaybackRate(
      layer.node as Tone.Player | Tone.GrainPlayer,
      rate,
    );

    setLayers((prevLayers) =>
      prevLayers.map((l) => (l.id === id ? { ...l, playbackRate: rate } : l)),
    );
  };

  const handleReverseChange = (id: string, reverse: boolean) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (
      !layer ||
      !layer.node ||
      (layer.type !== 'freesound' && layer.type !== 'grain')
    )
      return;
    audioEngineRef.current.setReverse(
      layer.node as Tone.Player | Tone.GrainPlayer,
      reverse,
    );
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, reverse } : l)));
  };

  const handleLayerFilterCutoffChange = (id: string, freq: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;
    audioEngineRef.current.setLayerFilterCutoff(layer.node, freq);
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, filterCutoff: freq } : l)),
    );
  };

  const handleLayerFilterResonanceChange = (id: string, q: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;
    audioEngineRef.current.setLayerFilterResonance(layer.node, q);
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, filterResonance: q } : l)),
    );
  };

  const handleDriftToggle = (enabled: boolean) => {
    setDriftEnabled(enabled);
    layers.forEach((layer) => {
      if (layer.node) {
        audioEngineRef.current?.setLayerDrift(layer.node, enabled, driftPeriod);
      }
    });
  };

  const handleDriftPeriodChange = (value: number) => {
    setDriftPeriod(value);
    if (driftEnabled) {
      layers.forEach((layer) => {
        if (layer.node) {
          audioEngineRef.current?.setLayerDrift(layer.node, true, value);
        }
      });
    }
  };

  const handleProbabilityChange = (id: string, value: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (
      !layer ||
      !layer.node ||
      layer.type === 'freesound' ||
      layer.type === 'grain'
    )
      return;
    audioEngineRef.current.setProbability(layer.node as Tone.Sequence, value);
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, probability: value } : l)),
    );
  };

  const handleGrainSizeChange = (id: string, size: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node || layer.type !== 'grain') return;
    audioEngineRef.current.setGrainSize(layer.node as Tone.GrainPlayer, size);
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, grainSize: size } : l)),
    );
  };

  const handleGrainDriftChange = (id: string, drift: number) => {
    if (!audioEngineRef.current) return;
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node || layer.type !== 'grain') return;
    audioEngineRef.current.setGrainDrift(layer.node as Tone.GrainPlayer, drift);
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, grainDrift: drift } : l)),
    );
  };

  // ─── Session helpers ──────────────────────────────────────────────────────

  const collectSettings = (): SavedGlobalSettings => ({
    scale: globalScale,
    bpm: globalBPM,
    discreetMode,
    driftEnabled,
    driftPeriod,
    warmth,
    breatheEnabled,
    breathePeriod,
    delayFeedback,
    delayTime,
    delayCutoff,
    reverbDecay,
    reverbWet,
    reverbDiffusion,
    seed: sessionSeedRef.current ?? undefined,
  });

  const handleBuildSession = (name: string): SavedSession => {
    return buildSession(name, layers, collectSettings());
  };

  const handleEndSession = () => {
    handleRemoveAllLayers();
    setActiveSession(null);
    setIsSessionDirty(false);
    const seed = randomSeed();
    applySeed(seed);
  };

  const handleSaveChanges = async () => {
    if (!activeSession || !user) return;
    try {
      const updated = buildSession(
        activeSession.name,
        layers,
        collectSettings(),
        activeSession.id,
      );
      await saveUserSession(user.uid, updated);
      skipNextDirtyRef.current = true;
      setActiveSession(updated);
      setIsSessionDirty(false);
      toast({ title: 'Changes saved', description: activeSession.name });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: String(err),
      });
    }
  };

  const handleLoadSession = async (session: SavedSession) => {
    if (!audioEngineRef.current || !isEngineInitialized) return;

    // Stop and clear all current layers
    handleRemoveAllLayers();

    // Apply global settings
    const s = session.settings;
    setGlobalScale(s.scale);
    setDiscreetMode(s.discreetMode);
    setDriftEnabled(s.driftEnabled);
    setDriftPeriod(s.driftPeriod);
    handleBPMChange(s.bpm);
    handleWarmthChange(s.warmth);
    handleBreatheToggle(s.breatheEnabled);
    setBreathePeriod(s.breathePeriod);
    if (s.breatheEnabled)
      audioEngineRef.current.setBreatheEnabled(true, s.breathePeriod);
    handleDelayFeedbackChange(s.delayFeedback);
    handleDelayTimeChange(s.delayTime);
    handleDelayCutoffChange(s.delayCutoff);
    handleReverbDecayChange(s.reverbDecay);
    handleReverbWetChange(s.reverbWet);
    handleReverbDiffusionChange(s.reverbDiffusion);

    // Restore seed — creates a fresh RNG at position 0 so layer recreation
    // draws the same parameter sequence as the original session
    if (s.seed != null) {
      applySeed(s.seed);
    } else {
      clearSeed();
    }

    // Recreate layers serially
    for (let i = 0; i < session.layers.length; i++) {
      const savedLayer = session.layers[i];
      const id = `layer_${Date.now()}_${Math.random()}`;
      const stub = {
        id,
        title: savedLayer.title,
        volume: savedLayer.volume,
        send: savedLayer.send,
        node: null as null,
        type: savedLayer.type as 'freesound' | 'grain' | 'synth' | 'melodic',
        status: 'loading' as const,
        // On mobile use fresh clamped positions; saved positions may be off-screen
        position: isMobile ? getNewLayerPosition(i) : savedLayer.position,
        zIndex: maxZIndex + 1,
      };
      setLayers((prev) => [...prev, stub]);

      try {
        if (savedLayer.type === 'freesound') {
          const playerData = await audioEngineRef.current.startFreesoundLoop({
            id: savedLayer.freesoundId,
            name: savedLayer.freesoundName,
            previewUrl: savedLayer.previewUrl,
          });
          if (!playerData) {
            setLayers((prev) => prev.filter((l) => l.id !== id));
            continue;
          }

          audioEngineRef.current.setVolume(
            playerData.player,
            savedLayer.volume,
          );
          audioEngineRef.current.setSendAmount(
            playerData.player,
            savedLayer.send,
          );
          audioEngineRef.current.setPlaybackRate(
            playerData.player,
            savedLayer.playbackRate,
          );
          audioEngineRef.current.setReverse(
            playerData.player,
            savedLayer.reverse,
          );
          audioEngineRef.current.setLayerFilterCutoff(
            playerData.player,
            savedLayer.filterCutoff,
          );
          audioEngineRef.current.setLayerFilterResonance(
            playerData.player,
            savedLayer.filterResonance,
          );
          if (s.driftEnabled)
            audioEngineRef.current.setLayerDrift(
              playerData.player,
              true,
              s.driftPeriod,
            );

          setLayers((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    node: playerData.player,
                    info: playerData.info,
                    status: 'playing',
                    filterCutoff: savedLayer.filterCutoff,
                    filterResonance: savedLayer.filterResonance,
                    playbackRate: savedLayer.playbackRate,
                    reverse: savedLayer.reverse,
                  }
                : l,
            ),
          );
        } else if (savedLayer.type === 'grain') {
          const grainData = await audioEngineRef.current.startGrainLoop({
            id: savedLayer.freesoundId,
            name: savedLayer.freesoundName,
            previewUrl: savedLayer.previewUrl,
          });
          if (!grainData) {
            setLayers((prev) => prev.filter((l) => l.id !== id));
            continue;
          }
          audioEngineRef.current.setVolume(grainData.player, savedLayer.volume);
          audioEngineRef.current.setSendAmount(
            grainData.player,
            savedLayer.send,
          );
          audioEngineRef.current.setPlaybackRate(
            grainData.player,
            savedLayer.playbackRate,
          );
          audioEngineRef.current.setReverse(
            grainData.player,
            savedLayer.reverse,
          );
          audioEngineRef.current.setLayerFilterCutoff(
            grainData.player,
            savedLayer.filterCutoff,
          );
          audioEngineRef.current.setLayerFilterResonance(
            grainData.player,
            savedLayer.filterResonance,
          );
          audioEngineRef.current.setGrainSize(
            grainData.player,
            savedLayer.grainSize,
          );
          audioEngineRef.current.setGrainDrift(
            grainData.player,
            savedLayer.grainDrift,
          );
          if (s.driftEnabled)
            audioEngineRef.current.setLayerDrift(
              grainData.player,
              true,
              s.driftPeriod,
            );

          setLayers((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    node: grainData.player,
                    info: grainData.info,
                    status: 'playing',
                    filterCutoff: savedLayer.filterCutoff,
                    filterResonance: savedLayer.filterResonance,
                    playbackRate: savedLayer.playbackRate,
                    reverse: savedLayer.reverse,
                    grainSize: savedLayer.grainSize,
                    grainDrift: savedLayer.grainDrift,
                  }
                : l,
            ),
          );
        } else {
          const loopData =
            savedLayer.type === 'melodic'
              ? audioEngineRef.current.startMelodicLoop(s.scale, s.discreetMode)
              : audioEngineRef.current.startSynthLoop(s.scale, s.discreetMode);
          if (!loopData) {
            setLayers((prev) => prev.filter((l) => l.id !== id));
            continue;
          }

          audioEngineRef.current.setVolume(
            loopData.sequence,
            savedLayer.volume,
          );
          audioEngineRef.current.setSendAmount(
            loopData.sequence,
            savedLayer.send,
          );
          audioEngineRef.current.setLayerFilterCutoff(
            loopData.sequence,
            savedLayer.filterCutoff,
          );
          audioEngineRef.current.setLayerFilterResonance(
            loopData.sequence,
            savedLayer.filterResonance,
          );
          audioEngineRef.current.setProbability(
            loopData.sequence,
            savedLayer.probability,
          );
          if (s.driftEnabled)
            audioEngineRef.current.setLayerDrift(
              loopData.sequence,
              true,
              s.driftPeriod,
            );

          setLayers((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    node: loopData.sequence,
                    info: loopData.info,
                    status: 'playing',
                    filterCutoff: savedLayer.filterCutoff,
                    filterResonance: savedLayer.filterResonance,
                    probability: savedLayer.probability,
                  }
                : l,
            ),
          );
        }
      } catch (err) {
        console.error('Failed to recreate layer', savedLayer.title, err);
        setLayers((prev) => prev.filter((l) => l.id !== id));
      }
    }

    // Set active session AFTER all layers are loaded. Skip flag prevents the
    // effect from immediately marking the freshly-loaded state as dirty.
    skipNextDirtyRef.current = true;
    setActiveSession(session);
    setIsSessionDirty(false);
    toast({ title: 'Session loaded', description: session.name });
  };

  const handleStartAudio = async () => {
    await Tone.start();
    if (audioEngineRef.current) {
      audioEngineRef.current.initialize();
      setGlobalBPM(audioEngineRef.current.getBPM());
      setIsEngineInitialized(true);
      // Arm the engine with URL seed (if present) or generate a fresh one
      const seed = sessionSeedRef.current ?? randomSeed();
      applySeed(seed);
    }
    setIsAudioReady(true);
  };

  return (
    <div className='relative w-full h-dvh flex flex-col overflow-hidden'>
      {/* Recording border overlay — sits above all content so the inset shadow is visible */}
      {isRecording && (
        <div
          className='absolute inset-0 pointer-events-none z-40'
          style={{
            boxShadow:
              'inset 0 0 0 3px rgb(220 38 38), inset 0 0 32px rgba(220,38,38,0.2)',
          }}
        />
      )}
      <AudioEngine ref={audioEngineRef} isMobile={isMobile} />

      {isMobile && !isAudioReady && (
        <div className='absolute inset-0 bg-black/50 z-50 flex items-center justify-center'>
          <div className='w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans'>
            <div className='bg-blue-800 text-white flex items-center p-1'>
              <span className='font-bold text-sm select-none'>
                📲 Device Audio Permission
              </span>
            </div>
            <div className='p-4 flex flex-col items-center gap-4 text-black'>
              <div className='flex items-start gap-4 self-stretch'>
                <Speaker className='w-8 h-8 text-blue-600 flex-shrink-0' />
                <div>
                  <p className='mb-4'>
                    Mobile devices require permission to play audio.
                  </p>
                  <p>Please click the button below to enable audio.</p>

                  <Fieldset label='Btw' variant='info' className='mt-6'>
                    <p className='text-xs'>
                      No audio will play if your phone is set to silent 🪨
                    </p>
                  </Fieldset>
                </div>
              </div>
              <Button
                variant='retro'
                className='px-8'
                onClick={handleStartAudio}
              >
                ✨ Enable Audio
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className='flex-grow blueprint-grid relative'>
        <div
          className='absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] flex max-w-[calc(100dvw-2rem-env(safe-area-inset-left)-env(safe-area-inset-right))] flex-wrap gap-x-2 gap-y-2 sm:max-w-none'
          style={{ zIndex: DESKTOP_ICON_Z_INDEX }}
        >
          <DesktopIcon
            imageUrl='/concreteicon.png'
            label='Readme.info'
            onClick={() => openWindow('about')}
          />
          <DesktopIcon
            imageUrl='/cog.png'
            label='Settings.exe'
            onClick={() => openWindow('settings')}
          />
          <DesktopIcon
            imageUrl='/masterfxicon.png'
            label='MasterFX.exe'
            onClick={() => openWindow('master')}
          />
          <DesktopIcon
            imageUrl='/scopeicon.png'
            label='Scope.exe'
            onClick={() => openWindow('scope')}
          />
        </div>

        <div className='absolute top-0 left-0 w-full h-full'>
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
              filterCutoff={layer.filterCutoff}
              filterResonance={layer.filterResonance}
              probability={layer.probability}
              reverse={layer.reverse}
              grainSize={layer.grainSize}
              grainDrift={layer.grainDrift}
              onRemove={handleRemoveLayer}
              onVolumeChange={handleVolumeChange}
              onSendChange={handleSendChange}
              onPlaybackRateChange={handlePlaybackRateChange}
              onReverseChange={handleReverseChange}
              onFilterCutoffChange={handleLayerFilterCutoffChange}
              onFilterResonanceChange={handleLayerFilterResonanceChange}
              onProbabilityChange={handleProbabilityChange}
              onGrainSizeChange={(size) =>
                handleGrainSizeChange(layer.id, size)
              }
              onGrainDriftChange={(drift) =>
                handleGrainDriftChange(layer.id, drift)
              }
              onMouseDown={(e) => handleDragStart(layer.id, 'layer', e)}
              onTouchStart={(e) => handleDragStart(layer.id, 'layer', e)}
            />
          ))}
          {windows.map((win) => {
            if (!win.isOpen) return null;
            if (win.id === 'scope') {
              return (
                <LissajousWindow
                  key={win.id}
                  audioEngineRef={audioEngineRef}
                  position={win.position}
                  zIndex={win.zIndex}
                  onClose={() => closeWindow(win.id)}
                  onMouseDown={(e) => handleDragStart(win.id, 'window', e)}
                  onTouchStart={(e) => handleDragStart(win.id, 'window', e)}
                />
              );
            }
            return (
              <InfoWindow
                key={win.id}
                title={win.title}
                position={win.position}
                zIndex={win.zIndex}
                onClose={() => closeWindow(win.id)}
                onMouseDown={(e) => handleDragStart(win.id, 'window', e)}
                onTouchStart={(e) => handleDragStart(win.id, 'window', e)}
              >
                {win.id === 'about' ? <AboutConcrete95Body /> : win.content}
              </InfoWindow>
            );
          })}
          {layers.length === 0 && !isAlertDismissed && isEngineInitialized && (
            <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
              <div className='w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans'>
                <div className='bg-blue-800 text-white flex items-center p-1'>
                  <span className='font-bold text-sm select-none'>
                    Welcome to Concrete 95!
                  </span>
                </div>
                <div className='p-4 flex flex-col items-center gap-4 text-black'>
                  <div className='flex items-start gap-4 self-stretch'>
                    <Info className='w-8 h-8 text-blue-600 flex-shrink-0' />
                    <div>
                      <p>Click the "Start" button to add a sound layer.</p>
                    </div>
                  </div>
                  <Button
                    variant='retro'
                    className='px-8'
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

      <footer className='w-full h-10 bg-silver border-t-2 border-t-white flex items-center px-2 z-20 shrink-0'>
        <SoundscapeController
          onAddSynthLayer={addSynthLayer}
          onAddFreesoundLayer={addFreesoundLayer}
          onAddGrainLayer={addGrainLayer}
          onAddMelodicLayer={addMelodicLayer}
          onStopAll={handleRemoveAllLayers}
          canAddLayer={layers.length < MAX_LAYERS && isEngineInitialized}
          hasLayers={layers.length > 0}
          isEngineInitialized={isEngineInitialized}
          onBuildSession={handleBuildSession}
          onLoadSession={handleLoadSession}
          onSignIn={() => setSessionsAuthOpen(true)}
          activeSession={activeSession}
          isSessionDirty={isSessionDirty}
          onSaveChanges={handleSaveChanges}
          onEndSession={handleEndSession}
        />
        <div className='flex-grow flex items-center gap-1 mx-1 overflow-hidden h-full'>
          {windows
            .filter((w) => w.isOpen)
            .map((win) => (
              <TaskbarItem
                key={win.id}
                icon={win.icon}
                label={win.title}
                isActive={activeItemId === win.id}
                onClick={() => bringToFront(win.id, 'window')}
              />
            ))}
          {layers.map((layer) => (
            <TaskbarItem
              key={layer.id}
              icon={layerIcons[layer.type]}
              label={layer.title}
              isActive={activeItemId === layer.id}
              onClick={() => bringToFront(layer.id, 'layer')}
            />
          ))}
        </div>
        <div className='bg-silver border-2 border-r-white border-b-white border-l-neutral-500 border-t-neutral-500 px-1 h-8 flex items-center shrink-0 gap-2'>
          {/* VU meter — desktop only */}
          <div className='hidden sm:flex'>
            <VUMeter audioEngineRef={audioEngineRef} />
          </div>
          <div className='hidden sm:block w-px h-4 bg-neutral-400 shrink-0' />
          {/* Record button */}
          {isEngineInitialized && (
            <>
              <button
                className={`flex items-center justify-center gap-1 text-xs w-6 h-6 sm:w-auto sm:h-auto sm:px-1.5 sm:py-0.5 border ${
                  isRecording
                    ? 'border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-neutral-200 text-red-700'
                    : 'border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 hover:bg-neutral-200 text-black'
                }`}
                onClick={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                title={
                  isRecording
                    ? 'Stop recording and download'
                    : 'Start recording'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full bg-red-600 shrink-0 ${isRecording ? 'animate-pulse' : ''}`}
                />
                <span className='hidden sm:inline'>
                  {isRecording
                    ? `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`
                    : 'REC'}
                </span>
              </button>
              <div className='w-px h-4 bg-neutral-400 shrink-0' />
            </>
          )}

          {/* MIDI Clock button + diode — only shown in browsers that support Web MIDI */}
          {midiSupported && (
            <div className='relative flex items-center gap-1'>
              <button
                className={`flex items-center justify-center gap-1 text-xs w-6 h-6 sm:w-auto sm:h-auto sm:px-1.5 sm:py-0.5 border text-neutral-700 ${
                  midiPanelOpen
                    ? 'border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-neutral-200'
                    : 'border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 hover:bg-neutral-200'
                }`}
                onClick={() => setMidiPanelOpen((o) => !o)}
                title='MIDI Clock Slave'
              >
                {/* Beat diode */}
                <span
                  className='w-2 h-2 rounded-full shrink-0'
                  style={{
                    backgroundColor: midiDiodeLit
                      ? '#16a34a'
                      : midiReceiving
                        ? '#4ade80'
                        : '#52525b',
                    boxShadow: midiDiodeLit ? '0 0 4px #16a34a' : 'none',
                    transition: 'background-color 80ms, box-shadow 80ms',
                  }}
                />
                <span className='hidden sm:inline text-xs'>MIDI</span>
              </button>
              {midiPanelOpen && (
                <MidiClockPanel
                  isSupported={midiSupported}
                  ports={midiPorts}
                  selectedPortId={midiPortId}
                  onSelectPort={setMidiPortId}
                  isReceiving={midiReceiving}
                  syncedBpm={midiSyncedBpm}
                  onClose={() => setMidiPanelOpen(false)}
                />
              )}
            </div>
          )}
          {midiSupported && (
            <div className='hidden sm:block w-px h-4 bg-neutral-400 shrink-0' />
          )}

          <Button
            variant='ghost'
            size='icon'
            className='w-5 h-5 p-0 m-0 !bg-transparent hover:!bg-neutral-300'
            onClick={() => openWindow('fxbus')}
          >
            <SlidersHorizontal className='w-4 h-4 text-black' />
          </Button>
          {/* Share button */}
          {isEngineInitialized && displaySeed != null && (
            <div className='relative flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                className='w-5 h-5 p-0 m-0 !bg-transparent hover:!bg-neutral-300'
                onClick={() => setSharePanelOpen((o) => !o)}
                title='Share soundscape'
              >
                <Share2 className='w-3 h-3 text-black' />
              </Button>
              {sharePanelOpen && (
                <SharePanel
                  seed={displaySeed}
                  onClose={() => setSharePanelOpen(false)}
                />
              )}
            </div>
          )}
          <div className='hidden sm:block'>
            <DigitalClock />
          </div>
        </div>
      </footer>

      <SessionsAuthModal
        open={sessionsAuthOpen}
        onOpenChange={setSessionsAuthOpen}
        onSignedIn={() => setSessionsAuthOpen(false)}
      />

      {exportBlob && (
        <RecordingExportDialog
          blob={exportBlob}
          durationSeconds={exportDuration}
          defaultName={`concrete95-${new Date().toISOString().slice(0, 10)}`}
          onDownload={handleExportDownload}
          onCancel={handleExportClose}
        />
      )}
    </div>
  );
}
