
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
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
  progress?: number;
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

function LoadingAnimation({ progress = 0 }: { progress?: number }) {
  const numBlocks = 15;
  const filledBlocks = Math.round(progress * numBlocks);
  
  return (
    <div className="w-full h-5 bg-white border-2 border-r-neutral-200 border-b-neutral-200 border-l-neutral-500 border-t-neutral-500 p-0.5 overflow-hidden">
      <div className="w-full h-full flex gap-px">
        {Array.from({ length: numBlocks }).map((_, i) => (
          <div
            key={i}
            className={`flex-grow h-full ${i < filledBlocks ? 'bg-blue-800' : 'bg-transparent'}`}
          />
        ))}
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
  progress,
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

  if (status === 'loading') {
    return (
      <div
        className="w-64 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute select-none"
        style={cardStyle}
      >
        <div className="bg-neutral-500 text-white flex items-center justify-between p-1 cursor-move">
           <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-neutral-400">Loading...</span>
          </div>
        </div>
        <div className="p-4 flex flex-col items-center justify-center space-y-3">
          <p className="text-black">Loading sound layer...</p>
          <LoadingAnimation progress={progress} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-64 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute"
      style={cardStyle}
      onMouseDown={onMouseDown}
    >
      {/* Title Bar */}
      <div className="bg-blue-800 text-white flex items-center justify-between p-1 cursor-move">
        <div className="flex items-center gap-2">
          {layerIcons[type]}
          <span className="font-bold text-sm select-none">{title}</span>
        </div>
        <Button
          variant="retro"
          size="icon"
          className="w-5 h-5"
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag from starting
            onRemove(id);
          }}
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()} // Prevent drag
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 flex items-center justify-center space-x-4" onMouseDown={(e) => e.stopPropagation()}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="retro" size="icon" title="Volume" onMouseDown={(e) => e.stopPropagation()}>
              <Volume2 className="text-black" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <p className="text-xs text-muted-foreground mb-2">
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
          <PopoverTrigger asChild>
            <Button variant="retro" size="icon" title="FX Send" onMouseDown={(e) => e.stopPropagation()}>
              <Wand2 className="text-black" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <p className="text-xs text-muted-foreground mb-2">
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
        {type === 'freesound' && playbackRate !== undefined && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="retro" size="icon" title="Speed" onMouseDown={(e) => e.stopPropagation()}>
                <FastForward className="text-black" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48">
              <p className="text-xs text-muted-foreground mb-2">
                Speed: {playbackRate.toFixed(2)}x
              </p>
              <Slider
                defaultValue={[playbackRate]}
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
