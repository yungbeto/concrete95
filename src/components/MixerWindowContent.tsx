'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import { Snowflake, Volume2, VolumeX } from 'lucide-react';
import { LAYER_TYPE_COLORS } from '@/components/LayerCard';

export type MixerLayer = {
  id: string;
  title: string;
  type: string;
  volume: number;
  send: number;
  status: 'loading' | 'playing' | 'stopped';
  isMuted?: boolean;
  isFrozen?: boolean;
};

type Props = {
  layers: MixerLayer[];
  onVolumeChange: (id: string, volume: number) => void;
  onSendChange: (id: string, send: number) => void;
  onMuteToggle: (id: string) => void;
  onFocusLayer: (id: string) => void;
};

/** Same ranges as the layer cards. */
const DB_MIN = -40;
const DB_MAX = 10;

const formatDb = (db: number) => (db <= DB_MIN ? '−∞' : `${db > 0 ? '+' : ''}${db}`);

function Fader({
  value,
  onChange,
  disabled,
  label,
  className,
  thumbClassName,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
  className: string;
  thumbClassName: string;
}) {
  return (
    <SliderPrimitive.Root
      orientation='vertical'
      min={DB_MIN}
      max={DB_MAX}
      step={1}
      value={[value]}
      disabled={disabled}
      onValueChange={(v) => onChange(v[0])}
      className={`relative flex flex-col items-center touch-none select-none ${className}`}
    >
      <SliderPrimitive.Track className='relative w-1 h-full grow overflow-hidden bg-neutral-300 border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white'>
        <SliderPrimitive.Range className='absolute w-full bg-blue-800' />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className={`block rounded-none bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 data-[disabled]:opacity-40 ${thumbClassName}`}
      />
    </SliderPrimitive.Root>
  );
}

/** Every layer as a channel strip: volume fader, FX send, mute. */
export default function MixerWindowContent({
  layers,
  onVolumeChange,
  onSendChange,
  onMuteToggle,
  onFocusLayer,
}: Props) {
  if (layers.length === 0) {
    return (
      <p className='text-xs text-neutral-600 text-center py-6'>
        No layers playing. Add one from the Start menu.
      </p>
    );
  }
  return (
    <div className='flex gap-1 overflow-x-auto pb-1 text-black'>
      {layers.map((layer) => {
        const muted = layer.isMuted ?? false;
        const loading = layer.status === 'loading';
        return (
          <div
            key={layer.id}
            className='flex flex-col items-center w-[52px] shrink-0 border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 bg-silver'
          >
            <button
              onClick={() => onFocusLayer(layer.id)}
              className={`w-full h-1.5 ${LAYER_TYPE_COLORS[layer.type] ?? 'bg-blue-800'}`}
              aria-label={`Bring ${layer.title} to front`}
              title={layer.title}
            />
            <div className='flex flex-col items-center gap-1 py-1.5 w-full'>
              {/* FX send (small) */}
              <span className='text-[9px] leading-none text-neutral-600'>FX</span>
              <Fader
                value={layer.send}
                onChange={(v) => onSendChange(layer.id, v)}
                disabled={loading}
                label={`${layer.title} FX send`}
                className='h-12'
                thumbClassName='w-3.5 h-2.5'
              />
              <span className='text-[9px] leading-none tabular-nums'>{formatDb(layer.send)}</span>

              {/* Volume (main) */}
              <Fader
                value={layer.volume}
                onChange={(v) => onVolumeChange(layer.id, v)}
                disabled={muted || loading}
                label={`${layer.title} volume`}
                className='h-32 mt-1'
                thumbClassName='w-5 h-3'
              />
              <span className='text-[10px] leading-none tabular-nums'>
                {muted ? 'mute' : formatDb(layer.volume)}
              </span>
              <button
                onClick={() => onMuteToggle(layer.id)}
                disabled={loading}
                className={`w-7 h-5 flex items-center justify-center border-2 focus:outline-none disabled:opacity-40 ${
                  muted
                    ? 'bg-neutral-300 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white'
                    : 'bg-silver border-t-white border-l-white border-r-neutral-500 border-b-neutral-500'
                }`}
                aria-label={muted ? `Unmute ${layer.title}` : `Mute ${layer.title}`}
                aria-pressed={muted}
              >
                {muted ? <VolumeX className='w-3 h-3 text-neutral-500' /> : <Volume2 className='w-3 h-3' />}
              </button>
            </div>
            <span
              className='w-full px-0.5 pb-1 text-[9px] leading-tight text-center truncate flex items-center justify-center gap-0.5'
              title={layer.title}
            >
              {layer.isFrozen && <Snowflake className='w-2.5 h-2.5 shrink-0 text-sky-700' aria-label='Frozen' />}
              <span className='truncate'>{layer.title}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
