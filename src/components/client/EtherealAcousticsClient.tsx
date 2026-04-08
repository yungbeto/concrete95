'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import AudioEngine, {
  type AudioEngineHandle,
  type FreesoundLayerInfo,
  type GrainLayerInfo,
  type SynthLayerInfo,
  type AtmosphereLayerInfo,
  type ScaleName,
  scaleNames,
  delayTimeOptions,
  type DelayTime,
} from '@/components/AudioEngine';
import SoundscapeController from '@/components/SoundscapeController';
import { searchFreesound, type FreesoundSound } from '@/actions/freesound';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import LayerCard from '@/components/LayerCard';
import VUMeter from '@/components/VUMeter';
import AudioDebugPanel from '@/components/AudioDebugPanel';
import { audioDebugLog } from '@/lib/audio-debug';
import {
  Info,
  Music,
  Settings,
  Waves,
  Wind,
  X,
  Zap,
  type LucideIcon,
  Speaker,
  SlidersHorizontal,
  Cpu,
  Activity,
  Share2,
  Sparkles,
  Palette,
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
  decodeSession,
  type SavedGlobalSettings,
  type SavedSession,
  saveSharedSession,
  loadSharedSession,
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

type LayerInfo =
  | FreesoundLayerInfo
  | GrainLayerInfo
  | SynthLayerInfo
  | AtmosphereLayerInfo;

type Layer = {
  id: string;
  title: string;
  volume: number;
  send: number;
  node: Tone.Player | Tone.GrainPlayer | Tone.Sequence | Tone.Noise | null;
  type: 'freesound' | 'grain' | 'synth' | 'melodic' | 'atmosphere';
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
  isMuted?: boolean;
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

const LAYER_TYPE_LABELS: Record<Layer['type'], string> = {
  synth: 'Pad',
  melodic: 'Melody',
  grain: 'Granulator',
  freesound: 'Sample',
  atmosphere: 'Atmosphere',
};

const generateSemanticName = (
  type: Layer['type'],
  existingLayers: Layer[],
): string => {
  const count = existingLayers.filter((l) => l.type === type).length + 1;
  return `${LAYER_TYPE_LABELS[type]} ${count}`;
};

type DesktopPattern = {
  id: string;
  label: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition?: string;
  // Scaled-down versions used for the swatch preview
  previewSize: string;
  previewPosition?: string;
};

const DESKTOP_PATTERNS: DesktopPattern[] = [
  {
    id: 'grid',
    label: 'Grid',
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px)',
    backgroundSize: '2rem 2rem',
    previewSize: '7px 7px',
  },
  {
    id: 'dots',
    label: 'Dots',
    backgroundImage:
      'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
    backgroundSize: '1.5rem 1.5rem',
    previewSize: '6px 6px',
  },
  {
    id: 'large-grid',
    label: 'Large Grid',
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px)',
    backgroundSize: '4rem 4rem',
    previewSize: '14px 14px',
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 1px, transparent 0, transparent 50%)',
    backgroundSize: '14px 14px',
    previewSize: '8px 8px',
  },
  {
    id: 'crosshatch',
    label: 'Crosshatch',
    backgroundImage:
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.1) 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, rgba(255,255,255,0.1) 0, rgba(255,255,255,0.1) 1px, transparent 0, transparent 50%)',
    backgroundSize: '14px 14px',
    previewSize: '8px 8px',
  },
  {
    id: 'isometric',
    label: 'Isometric',
    backgroundImage: [
      'linear-gradient(30deg, rgba(255,255,255,0.08) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.08) 87.5%)',
      'linear-gradient(150deg, rgba(255,255,255,0.08) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.08) 87.5%)',
      'linear-gradient(30deg, rgba(255,255,255,0.08) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.08) 87.5%)',
      'linear-gradient(150deg, rgba(255,255,255,0.08) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,0.08) 87.5%)',
      'linear-gradient(60deg, rgba(255,255,255,0.12) 25%, transparent 25.5%, transparent 75%, rgba(255,255,255,0.12) 75%)',
      'linear-gradient(60deg, rgba(255,255,255,0.12) 25%, transparent 25.5%, transparent 75%, rgba(255,255,255,0.12) 75%)',
    ].join(', '),
    backgroundSize: '20px 35px',
    backgroundPosition: '0 0, 0 0, 10px 18px, 10px 18px, 0 0, 10px 18px',
    previewSize: '10px 18px',
    previewPosition: '0 0, 0 0, 5px 9px, 5px 9px, 0 0, 5px 9px',
  },
  {
    id: 'lines',
    label: 'Lines',
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)',
    backgroundSize: '2rem 1.5rem',
    previewSize: '32px 6px',
  },
  {
    id: 'none',
    label: 'None',
    backgroundImage: 'none',
    backgroundSize: 'auto',
    previewSize: 'auto',
  },
];

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
  atmosphere: Wind,
};

function FeatureInfo({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='mt-2'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-700 select-none'
      >
        <Info className='w-3 h-3' />
        {open ? 'Hide info' : 'What is this?'}
      </button>
      {open && <p className='text-xs mt-1 text-neutral-700'>{children}</p>}
    </div>
  );
}

export default function EtherealAcousticsClient() {
  const audioEngineRef = useRef<AudioEngineHandle>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const { toast } = useToast();
  // Undo state — audio nodes are kept alive (muted) during the 5s window
  const undoSingleRef = useRef<{
    layer: Layer;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const undoAllRef = useRef<{
    layers: Layer[];
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [openStartMenu, setOpenStartMenu] = useState(false);
  const [globalScale, setGlobalScale] = useState<ScaleName>('major');
  const [delayFeedback, setDelayFeedback] = useState(0.4);
  const [delayTime, setDelayTime] = useState<DelayTime>('4n');
  const [delayCutoff, setDelayCutoff] = useState(5000);
  const [reverbDecay, setReverbDecay] = useState(10);
  const [reverbWet, setReverbWet] = useState(0.7);
  const [reverbDiffusion, setReverbDiffusion] = useState(0.7);
  const [warmth, setWarmth] = useState(0);
  const [shimmer, setShimmer] = useState(0);
  const [freqShift, setFreqShift] = useState(0);
  const [convolverMix, setConvolverMix] = useState(0);
  const [breatheEnabled, setBreatheEnabled] = useState(false);
  const [breathePeriod, setBreathePeriod] = useState(4);
  const [discreetMode, setDiscreetMode] = useState(true);
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [desktopPattern, setDesktopPattern] = useState<string>('grid');
  const [patternPickerOpen, setPatternPickerOpen] = useState(false);
  const sessionSeedRef = useRef<number | null>(null);
  const pendingSharedSessionRef = useRef<SavedSession | null>(null);
  const [sharedSessionReady, setSharedSessionReady] = useState(false);
  const [pendingSharedSessionLoaded, setPendingSharedSessionLoaded] =
    useState(false);

  // Read seed or shared session from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('s');
    if (s) {
      if (s.length <= 12) {
        // Short Firestore ID — fetch async
        loadSharedSession(s).then((session) => {
          if (session) {
            pendingSharedSessionRef.current = session;
            setPendingSharedSessionLoaded(true);
          }
        });
      } else {
        // lz-string or legacy base64 encoded session
        const session = decodeSession(s);
        if (session) {
          pendingSharedSessionRef.current = session;
          setPendingSharedSessionLoaded(true);
        }
      }
      return;
    }
  }, []);

  const applySeed = useCallback((seed: number) => {
    sessionSeedRef.current = seed;
    setDisplaySeed(seed);
    audioEngineRef.current?.setRng(createRng(seed));
  }, []);

  const clearSeed = useCallback(() => {
    sessionSeedRef.current = null;
    setDisplaySeed(null);
    audioEngineRef.current?.setRng(null);
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
    shimmer,
    breatheEnabled,
    breathePeriod,
    delayFeedback,
    delayTime,
    delayCutoff,
    reverbDecay,
    reverbWet,
    reverbDiffusion,
  ]);

  // Auto-save dirty sessions for authenticated users (30s debounce)
  useEffect(() => {
    if (!isSessionDirty || !activeSession || !user) return;
    const t = setTimeout(async () => {
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
      } catch {
        // Silent — manual save still available
      }
    }, 30_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionDirty, activeSession?.id, user?.uid]);

  // Warn before navigating away with unsaved session changes
  useEffect(() => {
    if (!isSessionDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isSessionDirty]);

  useEffect(() => {
    if (audioEngineRef.current && !isMobile) {
      setGlobalBPM(audioEngineRef.current.getBPM());
      setIsEngineInitialized(true);
      const seed = sessionSeedRef.current ?? randomSeed();
      applySeed(seed);
    }
  }, [isMobile, applySeed]);

  /**
   * Chromium (incl. Arc) keeps AudioContext suspended until a user gesture.
   * Tone.start() maps to context.resume(); we also call rawContext.resume() because
   * some builds only flip to `running` after the native promise resolves.
   */
  const ensureAudioUnlocked = useCallback(async () => {
    await Tone.start();
    const raw = Tone.getContext().rawContext as AudioContext;
    if (raw.state === 'suspended') {
      await raw.resume().catch(() => undefined);
    }
    Tone.getDestination().volume.value = 0;
    audioDebugLog('ensureAudioUnlocked', {
      state: raw.state,
      destinationDb: Tone.getDestination().volume.value,
    });
    if (process.env.NODE_ENV === 'development' && raw.state !== 'running') {
      // eslint-disable-next-line no-console
      console.warn(
        '[Concrete95] AudioContext state:',
        raw.state,
        '— click or press a key on the page, and check Arc site settings → Sound.',
      );
    }
  }, []);

  // First interaction anywhere on the window (capture): unlock before nested handlers run.
  useEffect(() => {
    const unlock = () => {
      void ensureAudioUnlocked();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [ensureAudioUnlocked]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void ensureAudioUnlocked();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [ensureAudioUnlocked]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never fire when typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return;

      // Cmd/Ctrl+S — save session
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveChanges();
        return;
      }

      const activeLayer = layers.find((l) => l.id === activeItemId);

      switch (e.key) {
        case 'm':
        case 'M':
          if (activeLayer) {
            e.preventDefault();
            handleMuteToggle(activeLayer.id);
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (activeLayer) {
            e.preventDefault();
            handleRemoveLayer(activeLayer.id);
          }
          break;
        case ' ':
          e.preventDefault();
          if (layers.length > 0) handleRemoveAllLayers();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemId, layers]);

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
            } else if (layer.type === 'atmosphere') {
              currentAudioEngine.stopAtmosphereLoop(layer.node as Tone.Noise);
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
    const cardW = 384; // w-96 (widest card)
    const cardH = 200; // approximate card height
    const maxX = Math.max(0, window.innerWidth - cardW - 16);
    const maxY = Math.max(0, window.innerHeight - cardH - 48); // 48 for footer
    return {
      x: Math.random() * Math.min(maxX, window.innerWidth / 2),
      y: Math.random() * Math.min(maxY, window.innerHeight / 3),
    };
  };

  const handleArrangeLayers = () => {
    if (layers.length === 0) return;
    const CARD_W = 320; // w-80 default card width
    const CARD_W_GRAIN = 384; // w-96 grain card
    const CARD_H = 260; // approximate card height including volume strip
    const GAP = 12;
    const FOOTER_H = 48;
    const TASKBAR_W = 220; // approximate start menu area
    const viewW = window.innerWidth - TASKBAR_W;
    const viewH = window.innerHeight - FOOTER_H;
    const cols = Math.max(1, Math.floor(viewW / (CARD_W + GAP)));

    setLayers((prev) =>
      prev.map((layer, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cardW = layer.type === 'grain' ? CARD_W_GRAIN : CARD_W;
        const x = TASKBAR_W + col * (cardW + GAP) + GAP;
        const y = row * (CARD_H + GAP) + GAP;
        return { ...layer, position: { x, y } };
      }),
    );
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
    type: Layer['type'],
    baseProperties: Partial<Layer> = {},
  ) => {
    if (!isEngineInitialized) {
      return;
    }
    const id = `layer_${Date.now()}_${Math.random()}`;
    const newLayerStub: Layer = {
      id,
      title: generateSemanticName(type, layers),
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

  const stopLayerAudio = useCallback((layer: Layer) => {
    if (!layer.node || !audioEngineRef.current) return;
    if (layer.type === 'freesound') {
      audioEngineRef.current.stopFreesoundLoop(layer.node as Tone.Player);
    } else if (layer.type === 'grain') {
      audioEngineRef.current.stopGrainLoop(layer.node as Tone.GrainPlayer);
    } else if (layer.type === 'melodic') {
      audioEngineRef.current.stopMelodicLoop(layer.node as Tone.Sequence);
    } else if (layer.type === 'synth') {
      audioEngineRef.current.stopSynthLoop(layer.node as Tone.Sequence);
    } else if (layer.type === 'atmosphere') {
      audioEngineRef.current.stopAtmosphereLoop(layer.node as Tone.Noise);
    }
  }, []);

  const handleRemoveLayer = (id: string) => {
    const layerToRemove = layers.find((l) => l.id === id);
    if (!layerToRemove) {
      setLayers((prev) => prev.filter((l) => l.id !== id));
      return;
    }

    // Mute immediately so silence is instant — audio node stays alive for undo
    if (layerToRemove.node && audioEngineRef.current) {
      audioEngineRef.current.setVolume(
        layerToRemove.node as Tone.Player,
        -Infinity,
      );
    }

    // Flush any previous pending single undo
    if (undoSingleRef.current) {
      clearTimeout(undoSingleRef.current.timeoutId);
      stopLayerAudio(undoSingleRef.current.layer);
      undoSingleRef.current = null;
    }

    setLayers((prev) => prev.filter((l) => l.id !== id));

    const timeoutId = setTimeout(() => {
      stopLayerAudio(layerToRemove);
      undoSingleRef.current = null;
    }, 5000);
    undoSingleRef.current = { layer: layerToRemove, timeoutId };
  };

  const addSynthLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    await ensureAudioUnlocked();
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
    await ensureAudioUnlocked();
    const id = addLayer('freesound', { volume: -12, playbackRate: 1 });
    if (!id) return;

    try {
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
      if (!audioEngineRef.current) {
        handleRemoveLayer(id);
        return;
      }
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
    } catch (err) {
      console.error('Failed to add freesound layer:', err);
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: 'Failed to load sound.',
      });
      handleRemoveLayer(id);
    }
  };

  const addAtmosphereLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    await ensureAudioUnlocked();
    const id = addLayer('atmosphere', { volume: -28 });
    if (!id) return;

    const atmoData = audioEngineRef.current.startAtmosphereLoop();
    if (!atmoData) {
      handleRemoveLayer(id);
      return;
    }

    if (driftEnabled)
      audioEngineRef.current.setLayerDrift(atmoData.node, true, driftPeriod);

    setLayers((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              node: atmoData.node,
              info: atmoData.info,
              status: 'playing' as const,
              filterCutoff: atmoData.filterCutoff,
              filterResonance: atmoData.filterResonance,
            }
          : l,
      ),
    );
  };

  const addGrainLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    await ensureAudioUnlocked();
    const id = addLayer('grain', {
      volume: -12,
      playbackRate: 1,
      grainSize: 0.1,
      grainDrift: 1.0,
    });
    if (!id) return;

    try {
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
      if (!audioEngineRef.current) {
        handleRemoveLayer(id);
        return;
      }
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
    } catch (err) {
      console.error('Failed to add grain layer:', err);
      toast({
        variant: 'destructive',
        title: 'Freesound Error',
        description: 'Failed to load sound.',
      });
      handleRemoveLayer(id);
    }
  };

  const addMelodicLayer = async () => {
    if (!audioEngineRef.current || checkLayerLimit()) return;
    await ensureAudioUnlocked();
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

  const handleShimmerChange = (value: number) => {
    setShimmer(value);
    audioEngineRef.current?.setShimmer(value);
  };

  const handleFreqShiftChange = (value: number) => {
    setFreqShift(value);
    audioEngineRef.current?.setFreqShift(value);
  };

  const handleConvolverMixChange = (value: number) => {
    setConvolverMix(value);
    audioEngineRef.current?.setConvolverMix(value);
  };

  const handleMuteToggle = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer || !layer.node) return;
    const muted = !layer.isMuted;
    audioEngineRef.current?.setVolume(
      layer.node,
      muted ? -Infinity : layer.volume,
    );
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isMuted: muted } : l)),
    );
  };

  const handleRenameLayer = (id: string, newTitle: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, title: newTitle } : l)),
    );
  };

  const handleQuickStart = () => {
    setIsAlertDismissed(true);
    const pool: Array<() => void> = [
      addGrainLayer,
      addSynthLayer,
      addAtmosphereLayer,
      addMelodicLayer,
    ];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool[0]();
    setTimeout(() => pool[1](), 150);
    setTimeout(() => pool[2](), 300);
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
          <FeatureInfo>
            Each layer&apos;s volume slowly rises and falls at its own pace —
            sounds drift in and out of focus over time.
          </FeatureInfo>
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
          <FeatureInfo>
            New synth and melodic layers get prime-length loops (5, 7, 11, 13…
            measures) so they never re-align — inspired by Eno&apos;s tape-loop
            phase technique on <em>Discreet Music</em>.
          </FeatureInfo>
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

        <Fieldset label='Shimmer'>
          <p className='text-xs mb-2'>Amount: {shimmer.toFixed(2)}</p>
          <Slider
            defaultValue={[shimmer]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={(value) => handleShimmerChange(value[0])}
          />
          <FeatureInfo>
            Feeds a pitch-shifted copy (+1 octave) of the send bus into the
            reverb. The reverb tail gradually accumulates octave-up energy,
            producing a rising, crystalline halo around sounds.
          </FeatureInfo>
        </Fieldset>

        <Fieldset label='Frequency Drift'>
          <p className='text-xs mb-2'>Amount: {freqShift.toFixed(2)}</p>
          <Slider
            defaultValue={[freqShift]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={(value) => handleFreqShiftChange(value[0])}
          />
          <FeatureInfo>
            Shifts the reverb signal by 2Hz — producing slow inharmonic beating
            distinct from the octave shimmer. At low values it&apos;s barely
            perceptible; higher values create a metallic, ring-modulator halo.
          </FeatureInfo>
        </Fieldset>

        <Fieldset label='Space'>
          <p className='text-xs mb-2'>
            Mix: {convolverMix.toFixed(2)} (
            {convolverMix < 0.1
              ? 'Algorithmic'
              : convolverMix > 0.9
                ? 'Plate IR'
                : 'Blend'}
            )
          </p>
          <Slider
            defaultValue={[convolverMix]}
            max={1}
            min={0}
            step={0.01}
            onValueChange={(value) => handleConvolverMixChange(value[0])}
          />
          <FeatureInfo>
            Crossfades between the algorithmic reverb and a synthetic plate IR.
            The IR gives the mix a specific physical space rather than a generic
            wash.
          </FeatureInfo>
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
      shimmer,
      freqShift,
      convolverMix,
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
          <FeatureInfo>
            Subtle harmonic saturation on the master output. Start low — a
            little goes a long way.
          </FeatureInfo>
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
          <FeatureInfo>
            Slowly rises and falls over the selected period — the piece inhales
            and exhales.
          </FeatureInfo>
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
    if (layers.length === 0) return;

    // Mute everything immediately
    layers.forEach((layer) => {
      if (layer.node && audioEngineRef.current) {
        audioEngineRef.current.setVolume(layer.node as Tone.Player, -Infinity);
      }
    });

    // Flush any previous pending undo-all
    if (undoAllRef.current) {
      clearTimeout(undoAllRef.current.timeoutId);
      undoAllRef.current.layers.forEach(stopLayerAudio);
      undoAllRef.current = null;
    }
    // Also flush pending single-layer undo
    if (undoSingleRef.current) {
      clearTimeout(undoSingleRef.current.timeoutId);
      stopLayerAudio(undoSingleRef.current.layer);
      undoSingleRef.current = null;
    }

    const snapshot = [...layers];
    setLayers([]);

    const timeoutId = setTimeout(() => {
      snapshot.forEach(stopLayerAudio);
      undoAllRef.current = null;
    }, 5000);
    undoAllRef.current = { layers: snapshot, timeoutId };

    toast({
      title: 'All layers stopped',
      action: (
        <ToastAction
          altText='Undo'
          onClick={() => {
            if (!undoAllRef.current) return;
            clearTimeout(undoAllRef.current.timeoutId);
            const { layers: saved } = undoAllRef.current;
            saved.forEach((layer) => {
              if (layer.node && audioEngineRef.current) {
                audioEngineRef.current.setVolume(
                  layer.node as Tone.Player,
                  layer.isMuted ? -Infinity : layer.volume,
                );
              }
            });
            setLayers(saved);
            undoAllRef.current = null;
          }}
        >
          Undo
        </ToastAction>
      ),
      duration: 5000,
    });
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
    shimmer,
    freqShift,
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

  // Once the engine is ready and a shared session is loaded, show the overlay
  useEffect(() => {
    if (!isEngineInitialized) return;
    if (!pendingSharedSessionRef.current) return;
    setSharedSessionReady(true);
  }, [isEngineInitialized, pendingSharedSessionLoaded]);

  const handleStartSharedSession = async () => {
    const session = pendingSharedSessionRef.current;
    if (!session) return;
    pendingSharedSessionRef.current = null;
    setSharedSessionReady(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    window.history.replaceState(null, '', url.toString());
    await ensureAudioUnlocked();
    handleLoadSession(session, false);
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

  const handleLoadSession = async (
    session: SavedSession,
    trackAsSession = true,
  ) => {
    if (!audioEngineRef.current || !isEngineInitialized) return;
    await ensureAudioUnlocked();

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
    handleShimmerChange(s.shimmer ?? 0);
    handleFreqShiftChange(s.freqShift ?? 0);
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
    const failedLayers: string[] = [];
    for (let i = 0; i < session.layers.length; i++) {
      const savedLayer = session.layers[i];
      const id = `layer_${Date.now()}_${Math.random()}`;
      const stub = {
        id,
        title: savedLayer.title,
        volume: savedLayer.volume,
        send: savedLayer.send,
        node: null as null,
        type: savedLayer.type as
          | 'freesound'
          | 'grain'
          | 'synth'
          | 'melodic'
          | 'atmosphere',
        status: 'loading' as const,
        // On mobile use fresh clamped positions; saved positions may be off-screen
        position: isMobile
          ? getNewLayerPosition(i)
          : {
              x: Math.min(
                savedLayer.position.x,
                Math.max(0, window.innerWidth - 400),
              ),
              y: Math.min(
                savedLayer.position.y,
                Math.max(0, window.innerHeight - 200),
              ),
            },
        zIndex: maxZIndex + 1,
      };
      setLayers((prev) => [...prev, stub]);

      try {
        if (!audioEngineRef.current) {
          setLayers((prev) => prev.filter((l) => l.id !== id));
          break;
        }
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
        } else if (savedLayer.type === 'atmosphere') {
          const atmoData = audioEngineRef.current.startAtmosphereLoop();
          if (!atmoData) {
            setLayers((prev) => prev.filter((l) => l.id !== id));
            continue;
          }

          audioEngineRef.current.setVolume(atmoData.node, savedLayer.volume);
          audioEngineRef.current.setSendAmount(atmoData.node, savedLayer.send);
          audioEngineRef.current.setLayerFilterCutoff(
            atmoData.node,
            savedLayer.filterCutoff,
          );
          audioEngineRef.current.setLayerFilterResonance(
            atmoData.node,
            savedLayer.filterResonance,
          );
          if (s.driftEnabled)
            audioEngineRef.current.setLayerDrift(
              atmoData.node,
              true,
              s.driftPeriod,
            );

          setLayers((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    node: atmoData.node,
                    info: atmoData.info,
                    status: 'playing',
                    filterCutoff: savedLayer.filterCutoff,
                    filterResonance: savedLayer.filterResonance,
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
        failedLayers.push(savedLayer.title);
      }
    }

    if (failedLayers.length > 0) {
      toast({
        variant: 'destructive',
        title: `${failedLayers.length} layer${failedLayers.length > 1 ? 's' : ''} couldn't be restored`,
        description: `${failedLayers.join(', ')} — the audio may have been removed from Freesound.`,
      });
    }

    // Set active session AFTER all layers are loaded. Skip flag prevents the
    // effect from immediately marking the freshly-loaded state as dirty.
    if (trackAsSession) {
      skipNextDirtyRef.current = true;
      setActiveSession(session);
    }
    setIsSessionDirty(false);
    toast({ title: 'Session loaded', description: session.name });
  };

  const handleStartAudio = async () => {
    await ensureAudioUnlocked();
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
    <div
      className='relative w-full h-dvh flex flex-col overflow-hidden'
      onPointerDownCapture={() => {
        void ensureAudioUnlocked();
      }}
    >
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

      <AudioDebugPanel
        audioEngineRef={audioEngineRef}
        ensureAudioUnlocked={ensureAudioUnlocked}
        layerCount={layers.length}
        isEngineInitialized={isEngineInitialized}
      />

      {sharedSessionReady && (
        <div className='absolute inset-0 bg-black/50 z-50 flex items-center justify-center'>
          <div className='w-72 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 font-sans'>
            <div className='bg-blue-800 text-white flex items-center p-1'>
              <span className='font-bold text-sm select-none'>
                Shared Soundscape
              </span>
            </div>
            <div className='p-4 flex flex-col items-center gap-4 text-black text-sm'>
              <p className='text-center text-neutral-700'>
                Someone shared a soundscape with you. Click below to load and
                play it.
              </p>
              <Button
                variant='retro'
                className='px-8'
                onClick={handleStartSharedSession}
              >
                ▶ Listen
              </Button>
            </div>
          </div>
        </div>
      )}

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

      <main
        className='flex-grow relative bg-background'
        style={(() => {
          const p =
            DESKTOP_PATTERNS.find((x) => x.id === desktopPattern) ??
            DESKTOP_PATTERNS[0];
          return {
            backgroundImage: p.backgroundImage,
            backgroundSize: p.backgroundSize,
            backgroundPosition: p.backgroundPosition ?? 'initial',
          };
        })()}
      >
        <div
          className='absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] flex max-w-[calc(100dvw-2rem-env(safe-area-inset-left)-env(safe-area-inset-right))] flex-wrap gap-x-2 gap-y-2 sm:max-w-none'
          style={{ zIndex: DESKTOP_ICON_Z_INDEX }}
        >
          <DesktopIcon
            imageUrl='/concreteicon.png'
            label='Readme.info'
            onClick={() => openWindow('about')}
            isOpen={windows.find((w) => w.id === 'about')?.isOpen}
          />
          <DesktopIcon
            imageUrl='/cog.png'
            label='Settings.exe'
            onClick={() => openWindow('settings')}
            isOpen={windows.find((w) => w.id === 'settings')?.isOpen}
          />
          <DesktopIcon
            imageUrl='/masterfxicon.png'
            label='MasterFX.exe'
            onClick={() => openWindow('master')}
            isOpen={windows.find((w) => w.id === 'master')?.isOpen}
          />
          <DesktopIcon
            imageUrl='/fxbusicon.png'
            label='FXBus.exe'
            onClick={() => openWindow('fxbus')}
            isOpen={windows.find((w) => w.id === 'fxbus')?.isOpen}
          />
          <DesktopIcon
            imageUrl='/scopeicon.png'
            label='Scope.exe'
            onClick={() => openWindow('scope')}
            isOpen={windows.find((w) => w.id === 'scope')?.isOpen}
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
              isMuted={layer.isMuted ?? false}
              onMuteToggle={() => handleMuteToggle(layer.id)}
              onRenameLayer={(newTitle) =>
                handleRenameLayer(layer.id, newTitle)
              }
              onMouseDown={(e) => handleDragStart(layer.id, 'layer', e)}
              onTouchStart={(e) => handleDragStart(layer.id, 'layer', e)}
            />
          ))}
          {/* FX Send Bus — off-canvas drawer sliding in from the right */}
          {(() => {
            const fxWin = windows.find((w) => w.id === 'fxbus');
            if (!fxWin) return null;
            return (
              <>
                {/* Backdrop */}
                {fxWin.isOpen && (
                  <div
                    className="fixed inset-0"
                    style={{ zIndex: fxWin.zIndex - 1 }}
                    onClick={() => closeWindow('fxbus')}
                  />
                )}
                {/* Drawer */}
                <div
                  className={`fixed right-0 top-0 bottom-10 w-80 flex flex-col bg-silver border-l-2 border-l-neutral-600 shadow-[-4px_0_12px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-in-out ${fxWin.isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                  style={{ zIndex: fxWin.zIndex }}
                >
                  <div className="bg-blue-800 text-white flex items-center justify-between px-2 h-7 flex-shrink-0">
                    <span className="font-bold text-sm select-none font-sans">FX Send Bus</span>
                    <Button
                      variant="retro"
                      size="icon"
                      className="w-5 h-5"
                      onClick={() => closeWindow('fxbus')}
                    >
                      <X className="w-3 h-3 text-black" />
                    </Button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4">
                    {fxWin.content}
                  </div>
                </div>
              </>
            );
          })()}

          {windows.map((win) => {
            if (!win.isOpen) return null;
            if (win.id === 'fxbus') return null;
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
                <div className='p-4 flex flex-col gap-4 text-black'>
                  <div className='flex items-start gap-3 self-stretch'>
                    <Info className='w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5' />
                    <p className='text-sm'>
                      Add layers from the <strong>Start</strong> menu, or jump
                      straight in with a starter soundscape:
                    </p>
                  </div>
                  <div className='flex gap-2 self-stretch'>
                    <Button
                      variant='retro'
                      className='flex-1'
                      onClick={handleQuickStart}
                    >
                      ✨ Quick Start
                    </Button>
                    <Button
                      variant='retro'
                      className='flex-1'
                      onClick={() => {
                        setIsAlertDismissed(true);
                        setOpenStartMenu(true);
                      }}
                    >
                      Browse
                    </Button>
                  </div>
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
          onAddAtmosphereLayer={addAtmosphereLayer}
          onStopAll={handleRemoveAllLayers}
          onArrangeLayers={handleArrangeLayers}
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
          openMenu={openStartMenu}
        />
        <div className='flex-grow flex items-center gap-1 mx-1 overflow-hidden h-full min-w-0'>
          {/* Windows zone — shrinks to content, never crowds layers */}
          <div className='flex items-center gap-1 shrink-0'>
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
          </div>

          {/* Divider between windows and layers */}
          {windows.some((w) => w.isOpen) && layers.length > 0 && (
            <div className='w-px h-5 bg-neutral-400 shrink-0' />
          )}

          {/* Layers zone — scrolls horizontally so items never crush below readable size */}
          <div className='flex items-center gap-1 overflow-x-auto min-w-0 flex-1 scrollbar-none'>
            {layers.map((layer) => (
              <TaskbarItem
                key={layer.id}
                icon={layerIcons[layer.type]}
                label={layer.title}
                isActive={activeItemId === layer.id}
                onClick={() => bringToFront(layer.id, 'layer')}
                fixed
              />
            ))}
          </div>
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
          {/* Pattern picker */}
          <div className='relative flex items-center'>
            <Button
              variant='ghost'
              size='icon'
              className={`w-5 h-5 p-0 m-0 !bg-transparent hover:!bg-neutral-300 ${patternPickerOpen ? '!bg-neutral-300' : ''}`}
              onClick={() => setPatternPickerOpen((o) => !o)}
              title='Change desktop pattern'
            >
              <Palette className='w-3 h-3 text-black' />
            </Button>
            {patternPickerOpen && (
              <>
                <div
                  className='fixed inset-0 z-40'
                  onClick={() => setPatternPickerOpen(false)}
                />
                <div className='absolute bottom-full right-0 mb-1 z-50 select-none bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 w-max'>
                  {/* Win95 title bar */}
                  <div className='bg-blue-800 text-white flex items-center justify-between px-1.5 py-0.5'>
                    <span className='text-xs font-bold'>Desktop Pattern</span>
                    <button
                      className='w-4 h-4 bg-silver text-black flex items-center justify-center border border-t-white border-l-white border-r-neutral-600 border-b-neutral-600 text-[10px] font-bold leading-none hover:brightness-110'
                      onClick={() => setPatternPickerOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                  {/* Swatch grid */}
                  <div className='p-2 grid grid-cols-4 gap-2'>
                    {DESKTOP_PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setDesktopPattern(p.id);
                          setPatternPickerOpen(false);
                        }}
                        className='flex flex-col items-center gap-0.5 group'
                      >
                        <div
                          className={`w-10 h-7 border-2 ${
                            desktopPattern === p.id
                              ? 'border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white'
                              : 'border-t-white border-l-white border-r-neutral-500 border-b-neutral-500'
                          }`}
                          style={{
                            backgroundColor: 'hsl(222, 25%, 18%)',
                            backgroundImage: p.backgroundImage,
                            backgroundSize: p.previewSize,
                            backgroundPosition: p.previewPosition ?? 'initial',
                          }}
                        />
                        <span
                          className={`text-[9px] leading-tight ${desktopPattern === p.id ? 'text-black font-bold' : 'text-neutral-600 group-hover:text-black'}`}
                        >
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Share button */}
          {isEngineInitialized && (
            <div className='relative flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-5  py-0 m-0 !bg-transparent hover:!bg-neutral-300 flex items-center gap-1'
                onClick={async () => {
                  const opening = !sharePanelOpen;
                  setSharePanelOpen((o) => !o);
                  if (opening) {
                    setShareUrl(null);
                    const session = handleBuildSession(
                      activeSession?.name ?? 'Shared Soundscape',
                    );
                    const id = await saveSharedSession(session);
                    const url = new URL(
                      window.location.origin + window.location.pathname,
                    );
                    url.searchParams.set('s', id);
                    setShareUrl(url.toString());
                  }
                }}
                title='Share soundscape'
              >
                <Share2 className=' h-3 text-black' />
              </Button>
              {sharePanelOpen && (
                <SharePanel
                  shareUrl={shareUrl}
                  onClose={() => setSharePanelOpen(false)}
                />
              )}
            </div>
          )}
          {/* {displaySeed !== null && (
            <button
              className='hidden sm:flex items-center text-[9px] text-neutral-600 hover:text-black border border-neutral-400 px-1 h-5 font-mono select-all shrink-0'
              onClick={() => { navigator.clipboard.writeText(String(displaySeed)); toast({ title: 'Seed copied' }); }}
              title='Copy seed to clipboard'
            >
              #{displaySeed}
            </button>
          )} */}
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
