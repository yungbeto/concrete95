
'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, Zap, Waves, Music, Sparkles, Wind, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import LayerMenuBar from './LayerMenuBar';
import { type AudioEngineHandle, type FreesoundLayerInfo, type GrainLayerInfo, type SynthLayerInfo, type AtmosphereLayerInfo } from './AudioEngine';
import * as Tone from 'tone';
import { useRef, useEffect, useState } from 'react';

type LayerInfo = FreesoundLayerInfo | GrainLayerInfo | SynthLayerInfo | AtmosphereLayerInfo;

interface LayerCardProps {
  id: string;
  title: string;
  volume: number;
  send: number;
  status: 'loading' | 'playing' | 'stopped';
  type: 'synth' | 'freesound' | 'grain' | 'melodic' | 'atmosphere';
  position: { x: number; y: number };
  zIndex: number;
  playbackRate?: number;
  reverse?: boolean;
  filterCutoff?: number;
  filterResonance?: number;
  probability?: number;
  grainSize?: number;
  grainDrift?: number;
  audioEngineRef: React.RefObject<AudioEngineHandle>;
  node: Tone.Player | Tone.GrainPlayer | Tone.Sequence | Tone.Noise | null;
  info?: LayerInfo;
  onRemove: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onSendChange: (id: string, send: number) => void;
  onPlaybackRateChange: (id: string, rate: number) => void;
  onReverseChange: (id: string, reverse: boolean) => void;
  onFilterCutoffChange: (id: string, freq: number) => void;
  onFilterResonanceChange: (id: string, q: number) => void;
  onProbabilityChange: (id: string, value: number) => void;
  onGrainSizeChange: (size: number) => void;
  onGrainDriftChange: (drift: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  onRenameLayer: (newTitle: string) => void;
}

const layerIcons = {
  synth: <Zap className="w-4 h-4" />,
  freesound: <Waves className="w-4 h-4" />,
  grain: <Sparkles className="w-4 h-4" />,
  melodic: <Music className="w-4 h-4" />,
  atmosphere: <Wind className="w-4 h-4" />,
};

const LAYER_TYPE_COLORS: Record<string, string> = {
  synth:       'bg-purple-800',
  melodic:     'bg-teal-700',
  grain:       'bg-amber-700',
  freesound:   'bg-emerald-800',
  atmosphere:  'bg-slate-700',
};


function LoadingDisplay({ timeoutSeconds = 12 }: { timeoutSeconds?: number }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const timedOut = elapsed >= timeoutSeconds;

  return (
    <div className="flex flex-col gap-2 p-2">
      {timedOut ? (
        <div className="flex items-center gap-2 border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white bg-yellow-50 p-2 text-xs text-black">
          <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-700" />
          <span>Taking longer than expected. Check your connection or try a different sound.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-black">
            <span>Fetching audio…</span>
            <span>{elapsed}s</span>
          </div>
          {/* Win95-style indeterminate progress bar */}
          <div className="h-4 border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white bg-silver overflow-hidden">
            <div
              className="h-full bg-blue-800"
              style={{
                width: '40%',
                animation: 'win95-progress 1.4s ease-in-out infinite',
              }}
            />
          </div>
          <style>{`
            @keyframes win95-progress {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function GrainVisualizerDisplay({
  node,
  grainSize = 0.15,
  grainDrift = 1.0,
}: {
  node: Tone.GrainPlayer | null;
  grainSize?: number;
  grainDrift?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformCacheRef = useRef<Float32Array | null>(null);
  const seekRef = useRef<{ fraction: number; transportTime: number } | null>(null);
  const grainSizeRef = useRef(grainSize);
  const grainDriftRef = useRef(grainDrift);

  // Keep refs in sync with props without re-running the animation effect
  useEffect(() => { grainSizeRef.current = grainSize; }, [grainSize]);
  useEffect(() => { grainDriftRef.current = grainDrift; }, [grainDrift]);

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !node) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const buf = node.buffer;
    if (!buf?.duration) return;
    const offsetSec = fraction * buf.duration;
    seekRef.current = { fraction, transportTime: Tone.getTransport().seconds };
    node.stop();
    node.start(Tone.now(), offsetSec);
  };

  useEffect(() => {
    waveformCacheRef.current = null;
    seekRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !node) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    type Grain = { pos: number; born: number; life: number };
    const grains: Grain[] = [];
    let lastSpawn = 0;
    let animFrameId: number;

    const getWaveformCache = (): Float32Array | null => {
      if (waveformCacheRef.current) return waveformCacheRef.current;
      const buf = node.buffer;
      if (!buf || !buf.loaded) return null;
      const raw = buf.getChannelData(0);
      const W = canvas.offsetWidth || 280;
      const out = new Float32Array(W);
      const step = Math.ceil(raw.length / W);
      for (let x = 0; x < W; x++) {
        let peak = 0;
        for (let s = 0; s < step; s++) {
          const v = Math.abs(raw[x * step + s] || 0);
          if (v > peak) peak = v;
        }
        out[x] = peak;
      }
      waveformCacheRef.current = out;
      return out;
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const now = performance.now();
      const wf = getWaveformCache();
      const buf = node.buffer;
      const duration = buf?.duration ?? 30;

      const pr = (node as any).playbackRate;
      const rate = typeof pr === 'object' && pr !== null ? (pr.value ?? 0.1) : (pr ?? 0.1);
      const elapsed = Tone.getTransport().seconds;

      // After a seek, calculate playhead relative to the seek position
      let playheadFrac: number;
      if (seekRef.current) {
        const delta = (elapsed - seekRef.current.transportTime) * rate;
        playheadFrac = ((seekRef.current.fraction * duration + delta) % duration) / duration;
      } else {
        playheadFrac = duration > 0 ? ((elapsed * rate) % duration) / duration : 0;
      }
      playheadFrac = Math.max(0, Math.min(1, playheadFrac));

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      // Static buffer waveform
      if (wf) {
        ctx.fillStyle = '#0d2e0d';
        for (let x = 0; x < wf.length; x++) {
          const h = wf[x] * H;
          ctx.fillRect(x, (H - h) / 2, 1, h);
        }
      }

      // Spawn grains around playhead
      const gs = grainSizeRef.current;
      const gd = grainDriftRef.current;
      const spawnInterval = Math.max(30, gs * 400);
      if (now - lastSpawn > spawnInterval) {
        const scatter = (Math.random() - 0.5) * 2 * (gd / duration);
        const pos = Math.max(0, Math.min(1, playheadFrac + scatter));
        grains.push({ pos, born: now, life: gs * 1000 });
        lastSpawn = now;
        if (grains.length > 12) grains.shift();
      }

      // Draw grain windows
      const grainWidthPx = Math.max(2, (gs / duration) * W);
      for (let i = grains.length - 1; i >= 0; i--) {
        const g = grains[i];
        const alpha = Math.max(0, 1 - (now - g.born) / g.life);
        if (alpha <= 0) { grains.splice(i, 1); continue; }
        const x = g.pos * W - grainWidthPx / 2;
        ctx.fillStyle = `rgba(57,255,20,${alpha * 0.18})`;
        ctx.fillRect(x, 0, grainWidthPx, H);
        ctx.strokeStyle = `rgba(0,210,210,${alpha * 0.9})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, 0.5, grainWidthPx - 1, H - 1);
      }

      // Playhead line
      const px = playheadFrac * W;
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();

      animFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameId);
  }, [node]);

  return (
    <div className="flex flex-col gap-2 p-2" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <div className="flex-grow h-[40px] bg-black border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white p-1">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          width={320}
          height={36}
          onClick={handleSeek}
          onTouchEnd={(e) => { e.preventDefault(); handleSeek(e as any); }}
          title="Click to move grain position"
        />
      </div>
    </div>
  );
}

function SoundRecorderDisplay({
    audioEngineRef,
    node,
}: {
    audioEngineRef: React.RefObject<AudioEngineHandle>;
    node: Tone.Player | Tone.GrainPlayer | Tone.Sequence | Tone.Noise | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      if (!audioEngineRef.current || !node) return;

      const waveformData = audioEngineRef.current.getWaveform(node);
      if (!waveformData) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#39FF14'; // A bright green color

      const sliceWidth = canvas.width * 1.0 / waveformData.length;
      let x = 0;

      for (let i = 0; i < waveformData.length; i++) {
        const v = waveformData[i] / 1.4; // The 1.4 is a scaling factor
        const y = (v * canvas.height / 2) + (canvas.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [node, audioEngineRef]);


  return (
    <div className="flex flex-col gap-2 p-2" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <div className="flex items-stretch justify-between gap-2 text-black text-xs">
        <div className="flex-grow h-[40px] bg-black border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white p-1">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}

export default function LayerCard({
  id,
  title,
  volume,
  send,
  status,
  type,
  position,
  zIndex,
  playbackRate,
  reverse,
  filterCutoff,
  filterResonance,
  probability,
  grainSize,
  grainDrift,
  audioEngineRef,
  node,
  info,
  onRemove,
  onVolumeChange,
  onSendChange,
  onPlaybackRateChange,
  onReverseChange,
  onFilterCutoffChange,
  onFilterResonanceChange,
  onProbabilityChange,
  onGrainSizeChange,
  onGrainDriftChange,
  onMouseDown,
  onTouchStart,
  isMuted,
  onMuteToggle,
  onRenameLayer,
}: LayerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(title);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const cardStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: zIndex,
  };
  const isLoading = status === 'loading';

  return (
    <div 
      className={`${type === 'grain' ? 'w-96' : 'w-80'} bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute select-none`}
      style={cardStyle}
    >
        {/* Title Bar */}
        <div
            className={`${LAYER_TYPE_COLORS[type] ?? 'bg-blue-800'} ${isMuted ? 'opacity-60' : ''} text-white flex items-center justify-between p-1 cursor-move`}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
        >
            <div className="flex items-center gap-1 min-w-0 flex-1">
                {layerIcons[type]}
                {isEditing ? (
                  <input
                    autoFocus
                    className="bg-blue-900 text-white text-sm font-bold px-0.5 outline-none border-b border-white w-32 min-w-0"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => { onRenameLayer(editName.trim() || title); setIsEditing(false); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { onRenameLayer(editName.trim() || title); setIsEditing(false); }
                      if (e.key === 'Escape') { setEditName(title); setIsEditing(false); }
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="font-bold text-sm cursor-text"
                    onDoubleClick={(e) => { e.stopPropagation(); setEditName(title); setIsEditing(true); }}
                  >
                    {isLoading ? 'Loading...' : title}
                  </span>
                )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                className={`w-5 h-5 flex items-center justify-center border text-[9px] font-bold leading-none select-none
                  ${isMuted
                    ? 'border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-neutral-200 text-neutral-600'
                    : 'border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver text-black hover:bg-neutral-200'
                  }`}
                onClick={(e) => { e.stopPropagation(); onMuteToggle(); }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute layer' : 'Mute layer'}
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </button>
              <button
                className="w-5 h-5 flex items-center justify-center border border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver text-black hover:bg-neutral-200 text-[9px] font-bold leading-none select-none"
                onClick={(e) => { e.stopPropagation(); setIsCollapsed(c => !c); }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title={isCollapsed ? 'Restore' : 'Minimize'}
                aria-label={isCollapsed ? 'Restore layer' : 'Minimize layer'}
              >
                {isCollapsed ? '▲' : '▼'}
              </button>
              <Button
                variant="retro"
                size="icon"
                className="w-5 h-5"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(id);
                }}
                aria-label="Close"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <X className="w-3 h-3 text-black" />
              </Button>
            </div>
        </div>

        {/* Body — hidden when collapsed */}
        {!isCollapsed && (
          <>
            {/* Menu Bar */}
            <div onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                <LayerMenuBar
                    type={type}
                    send={send}
                    playbackRate={playbackRate}
                    reverse={reverse}
                    filterCutoff={filterCutoff}
                    filterResonance={filterResonance}
                    probability={probability}
                    grainSize={grainSize}
                    grainDrift={grainDrift}
                    info={info}
                    onSendChange={(value) => onSendChange(id, value)}
                    onPlaybackRateChange={(value) => onPlaybackRateChange(id, value)}
                    onReverseChange={(value) => onReverseChange(id, value)}
                    onFilterCutoffChange={(value) => onFilterCutoffChange(id, value)}
                    onFilterResonanceChange={(value) => onFilterResonanceChange(id, value)}
                    onProbabilityChange={(value) => onProbabilityChange(id, value)}
                    onGrainSizeChange={onGrainSizeChange}
                    onGrainDriftChange={onGrainDriftChange}
                />
            </div>

            {/* Visualizer or loading state */}
            {isLoading
              ? <LoadingDisplay />
              : type === 'grain'
                ? <GrainVisualizerDisplay node={node as Tone.GrainPlayer | null} grainSize={grainSize} grainDrift={grainDrift} />
                : <SoundRecorderDisplay audioEngineRef={audioEngineRef} node={node as Tone.Player | Tone.GrainPlayer | Tone.Sequence | null} />
            }

            {/* Always-visible volume strip */}
            <div
              className="flex items-center gap-2 px-2 pb-2"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {isMuted
                ? <VolumeX className="w-3 h-3 shrink-0 text-neutral-500" />
                : <Volume2 className="w-3 h-3 shrink-0 text-black" />
              }
              <Slider
                min={-40}
                max={10}
                step={1}
                value={[isMuted ? -40 : volume]}
                onValueChange={(val) => onVolumeChange(id, val[0])}
                className="flex-1"
                aria-label="Volume"
              />
              <span className="text-[10px] text-black w-10 text-right tabular-nums">
                {isMuted ? 'muted' : volume <= -40 ? '−∞' : `${volume > 0 ? '+' : ''}${volume}dB`}
              </span>
            </div>
          </>
        )}
      
    </div>
  );
}
