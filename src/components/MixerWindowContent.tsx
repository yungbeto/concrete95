'use client';

import { useEffect, useRef } from 'react';
import type * as Tone from 'tone';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Music, Radio, Snowflake, Sparkles, Volume1, Waves, Wind, Zap } from 'lucide-react';
import { LAYER_TYPE_COLORS } from '@/components/LayerCard';
import type { AudioEngineHandle } from '@/components/AudioEngine';

type MixerNode = Tone.Player | Tone.GrainPlayer | Tone.Sequence | Tone.Noise | Tone.Gain | null;

export type MixerLayer = {
  id: string;
  title: string;
  type: string;
  volume: number;
  send: number;
  status: 'loading' | 'playing' | 'stopped';
  node: MixerNode;
  isMuted?: boolean;
  isFrozen?: boolean;
};

type Props = {
  layers: MixerLayer[];
  audioEngineRef: React.RefObject<AudioEngineHandle>;
  onVolumeChange: (id: string, volume: number) => void;
  onSendChange: (id: string, send: number) => void;
  onMuteToggle: (id: string) => void;
  onFocusLayer: (id: string) => void;
};

/** Same ranges as the layer cards. */
const DB_MIN = -40;
const DB_MAX = 10;
/** Meter scale: −60 dBFS (empty) … 0 dBFS (full). */
const METER_FLOOR_DB = -60;
const METER_SEGMENTS = 14;

const TYPE_ICONS: Record<string, typeof Zap> = {
  synth: Zap,
  freesound: Waves,
  grain: Sparkles,
  melodic: Music,
  atmosphere: Wind,
  drone: Radio,
};

const raised =
  'bg-silver border-2 border-t-white border-l-white border-r-neutral-600 border-b-neutral-600';
const sunken = 'border border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white';

/** Win95 tick marks either side of a vertical track. */
const TICKS = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, #404040 0 1px, transparent 1px 12px)',
  backgroundSize: '6px 100%',
  backgroundRepeat: 'no-repeat',
} as const;

function VolumeFader({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className='relative h-[132px] w-9 flex justify-center'>
      {/* tick marks, left and right of the slot */}
      <div className='absolute inset-y-[5px] left-0 w-1.5' style={TICKS} aria-hidden />
      <div className='absolute inset-y-[5px] right-0 w-1.5' style={TICKS} aria-hidden />
      <SliderPrimitive.Root
        orientation='vertical'
        min={DB_MIN}
        max={DB_MAX}
        step={1}
        value={[value]}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
        className='relative flex flex-col items-center h-full w-full touch-none select-none data-[disabled]:opacity-60'
      >
        <SliderPrimitive.Track className='relative w-1 h-full grow bg-neutral-800 border border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white'>
          <SliderPrimitive.Range className='absolute w-full' />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          className={`relative block w-[22px] h-[11px] rounded-none ${raised} focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-2`}
        >
          <span className='absolute left-0.5 right-0.5 top-1/2 h-px -translate-y-1/2 bg-neutral-600' />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>
    </div>
  );
}

function SendSlider({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className='flex items-center gap-0.5 w-full'>
      <Volume1 className='w-3.5 h-3.5 shrink-0 text-neutral-700' aria-hidden />
      <div className='relative flex-1'>
        <SliderPrimitive.Root
          min={DB_MIN}
          max={DB_MAX}
          step={1}
          value={[value]}
          disabled={disabled}
          onValueChange={(v) => onChange(v[0])}
          className='relative flex items-center h-4 w-full touch-none select-none data-[disabled]:opacity-60'
        >
          <SliderPrimitive.Track className='relative h-1 w-full grow bg-white border border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white'>
            <SliderPrimitive.Range className='absolute h-full' />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            aria-label={label}
            className={`block w-[9px] h-4 rounded-none ${raised} focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:outline-offset-1`}
          />
        </SliderPrimitive.Root>
        {/* three ticks under the track */}
        <div className='flex justify-between px-[3px] h-1' aria-hidden>
          <span className='w-px h-full bg-neutral-700' />
          <span className='w-px h-full bg-neutral-700' />
          <span className='w-px h-full bg-neutral-700' />
        </div>
      </div>
      <Sparkles className='w-3.5 h-3.5 shrink-0 text-neutral-700' aria-hidden />
    </div>
  );
}

/** Sunken LED meter; segments are lit imperatively by the parent's rAF loop. */
function Meter({ meterRef }: { meterRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={meterRef}
      className={`h-[132px] w-2.5 bg-neutral-900 ${sunken} flex flex-col-reverse gap-px p-px`}
      aria-hidden
    >
      {Array.from({ length: METER_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`flex-1 opacity-20 ${
            i >= METER_SEGMENTS - 2 ? 'bg-red-500' : i >= METER_SEGMENTS - 5 ? 'bg-yellow-400' : 'bg-lime-400'
          }`}
        />
      ))}
    </div>
  );
}

function Checkbox({
  checked,
  onToggle,
  disabled,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      role='checkbox'
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className='flex items-center gap-1.5 text-xs select-none disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black'
    >
      <span aria-hidden className='w-3.5 h-3.5 shrink-0 border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white flex items-center justify-center'>
        {checked && (
          <span className='text-black leading-none' style={{ fontSize: '9px', marginTop: '-1px' }} aria-hidden>
            ✓
          </span>
        )}
      </span>
      {children}
    </button>
  );
}

const rmsDb = (buf: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
};

const lightMeter = (el: HTMLDivElement | null | undefined, db: number) => {
  if (!el) return;
  const lit = Number.isFinite(db)
    ? Math.round(Math.max(0, Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB)) * METER_SEGMENTS)
    : 0;
  const segs = el.children;
  for (let i = 0; i < segs.length; i++) {
    (segs[i] as HTMLElement).style.opacity = i < lit ? '1' : '0.2';
  }
};

const columnClass =
  'flex flex-col items-stretch gap-1.5 px-2.5 py-2 w-[104px] shrink-0 border-r border-neutral-500 shadow-[1px_0_0_white]';

/** Windows 95 "Volume Control"-style mixer: one column per layer. */
export default function MixerWindowContent({
  layers,
  audioEngineRef,
  onVolumeChange,
  onSendChange,
  onMuteToggle,
  onFocusLayer,
}: Props) {
  const meterEls = useRef(new Map<string, HTMLDivElement>());
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // One rAF loop for every meter; writes straight to the DOM (no re-renders).
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const engine = audioEngineRef.current;
      if (engine) {
        lightMeter(meterEls.current.get('__master'), engine.getMasterLevel());
        for (const layer of layersRef.current) {
          const buf = layer.node ? engine.getWaveform(layer.node) : null;
          lightMeter(meterEls.current.get(layer.id), buf ? rmsDb(buf) : -Infinity);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [audioEngineRef]);

  const setMeter = (id: string) => (el: HTMLDivElement | null) => {
    if (el) meterEls.current.set(id, el);
    else meterEls.current.delete(id);
  };

  const ready = layers.filter((l) => l.status !== 'loading');
  const allMuted = ready.length > 0 && ready.every((l) => l.isMuted);
  const toggleMuteAll = () => {
    const target = !allMuted;
    ready.forEach((l) => {
      if ((l.isMuted ?? false) !== target) onMuteToggle(l.id);
    });
  };

  return (
    <div className='text-black text-xs'>
      <div className='flex overflow-x-auto'>
        {/* Master column */}
        <div className={columnClass}>
          <div className='h-9 flex flex-col justify-end'>
            <span className='font-bold truncate'>Master</span>
          </div>
          <span className='text-neutral-600 leading-none'>Output</span>
          <div className='h-5' />
          <div className='h-px bg-neutral-500 shadow-[0_1px_0_white] my-1' />
          <span>Level:</span>
          <div className='flex justify-center'>
            <Meter meterRef={setMeter('__master')} />
          </div>
          <div className='mt-1'>
            <Checkbox checked={allMuted} onToggle={toggleMuteAll} disabled={!ready.length}>
              <span>
                <u>M</u>ute all
              </span>
            </Checkbox>
          </div>
        </div>

        {layers.length === 0 && (
          <div className='flex items-center px-6 text-neutral-600'>
            No layers playing. Add one from the Start menu.
          </div>
        )}

        {layers.map((layer) => {
          const muted = layer.isMuted ?? false;
          const loading = layer.status === 'loading';
          const Icon = TYPE_ICONS[layer.type] ?? Waves;
          return (
            <div key={layer.id} className={columnClass}>
              <button
                onClick={() => onFocusLayer(layer.id)}
                className='h-9 flex items-end gap-1 text-left min-w-0 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black'
                title={`${layer.title}: bring to front`}
              >
                <span
                  className={`w-4 h-4 shrink-0 flex items-center justify-center ${LAYER_TYPE_COLORS[layer.type] ?? 'bg-blue-800'}`}
                  aria-hidden
                >
                  <Icon className='w-3 h-3 text-white' />
                </span>
                <span className='truncate leading-tight'>{loading ? 'Loading…' : layer.title}</span>
                {layer.isFrozen && (
                  <Snowflake className='w-3 h-3 shrink-0 text-sky-700 mb-px' aria-label='Frozen' />
                )}
              </button>

              <span className='leading-none'>FX Send:</span>
              <SendSlider
                value={layer.send}
                onChange={(v) => onSendChange(layer.id, v)}
                disabled={loading}
                label={`${layer.title} FX send`}
              />

              <div className='h-px bg-neutral-500 shadow-[0_1px_0_white] my-1' />

              <span>Volume:</span>
              <div className='flex justify-center items-start gap-1.5'>
                <VolumeFader
                  value={layer.volume}
                  onChange={(v) => onVolumeChange(layer.id, v)}
                  disabled={muted || loading}
                  label={`${layer.title} volume`}
                />
                <Meter meterRef={setMeter(layer.id)} />
              </div>

              <div className='mt-1'>
                <Checkbox checked={muted} onToggle={() => onMuteToggle(layer.id)} disabled={loading}>
                  <span>
                    <u>M</u>ute
                  </span>
                </Checkbox>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className={`mt-0.5 px-1.5 py-0.5 ${sunken} text-[11px] text-neutral-800`}>
        Concrete 95 Mixer [{layers.length} layer{layers.length === 1 ? '' : 's'}]
      </div>
    </div>
  );
}
