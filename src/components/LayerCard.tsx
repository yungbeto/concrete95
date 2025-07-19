
'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Volume2, X, Wand2, Zap, Waves, Music, FastForward } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LayerCardProps {
  id: string;
  title: string;
  volume: number;
  send: number;
  status: 'loading' | 'loaded';
  type: 'synth' | 'freesound' | 'melodic';
  position: { x: number; y: number };
  zIndex: number;
  playbackRate?: number;
  onRemove: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onSendChange: (id: string, send: number) => void;
  onPlaybackRateChange: (id: string, rate: number) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const layerIcons = {
  synth: <Zap className="w-4 h-4" />,
  freesound: <Waves className="w-4 h-4" />,
  melodic: <Music className="w-4 h-4" />,
};

function SoundRecorderDisplay({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <div className="flex flex-col gap-2 p-2" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-stretch justify-between gap-2 text-black text-xs">
        <div className="border border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white p-4 text-center">
          <p>Position:</p>
          {isLoading ? <Skeleton className="h-4 w-12 mt-1" /> : <p>0.00 sec.</p>}
        </div>
        <div className="flex-grow h-auto bg-black  flex items-center justify-center p-1">
          <div className="w-full h-[2px] bg-green-500" />
        </div>
        <div className="border border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white p-4 text-center">
          <p>Length:</p>
          {isLoading ? <Skeleton className="h-4 w-12 mt-1" /> : <p>0.00 sec.</p>}
        </div>
      </div>
      <Slider defaultValue={[0]} max={100} step={1} disabled />
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
  onRemove,
  onVolumeChange,
  onSendChange,
  onPlaybackRateChange,
  onMouseDown,
}: LayerCardProps) {
  const cardStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: zIndex,
  };
  const isLoading = status === 'loading';

  return (
    <div 
      className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute select-none"
      style={cardStyle}
      onMouseDown={onMouseDown}
    >
      {/* Title Bar */}
      <div className="bg-blue-800 text-white flex items-center justify-between p-1 cursor-move">
        <div className="flex items-center gap-2">
          {layerIcons[type]}
          <span className="font-bold text-sm">{isLoading ? 'Loading...' : title}</span>
        </div>
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
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* Sound Recorder Display */}
      <SoundRecorderDisplay isLoading={isLoading} />
      
      {/* Separator */}
      <div className="h-[2px] w-full bg-silver border-t-neutral-500 border-b-white" />

      {/* Control Buttons */}
      <div className="p-2 flex items-center justify-center space-x-2" onMouseDown={(e) => e.stopPropagation()}>
        <Popover>
          <PopoverTrigger asChild disabled={isLoading}>
            <Button variant="retro" size="icon" title="Volume" onMouseDown={(e) => e.stopPropagation()}>
              <Volume2 className="text-black" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <p className="text-xs text-black mb-2">
              Volume: {volume > -40 ? `${volume.toFixed(0)} dB` : 'Muted'}
            </p>
            <Slider
              defaultValue={[volume]}
              max={10}
              min={-40}
              step={1}
              onValueChange={(value) => onVolumeChange(id, value[0])}
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild disabled={isLoading}>
            <Button variant="retro" size="icon" title="FX Send" onMouseDown={(e) => e.stopPropagation()}>
              <Wand2 className="text-black" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <p className="text-xs text-black mb-2">
              Send: {send > -40 ? `${send.toFixed(0)} dB` : 'Muted'}
            </p>
            <Slider
              defaultValue={[send]}
              max={10}
              min={-40}
              step={1}
              onValueChange={(value) => onSendChange(id, value[0])}
            />
          </PopoverContent>
        </Popover>
        {type === 'freesound' && (
          <Popover>
            <PopoverTrigger asChild disabled={isLoading}>
              <Button variant="retro" size="icon" title="Speed" onMouseDown={(e) => e.stopPropagation()}>
                <FastForward className="text-black" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <p className="text-xs text-black mb-2">
                Speed: {playbackRate?.toFixed(2) ?? '1.00'}x
              </p>
              <Slider
                defaultValue={[playbackRate ?? 1]}
                max={2}
                min={0.5}
                step={0.01}
                onValueChange={(value) => onPlaybackRateChange(id, value[0])}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
