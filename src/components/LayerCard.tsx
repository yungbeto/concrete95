
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
import { Volume2, X, Send, Zap, Waves, Music } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LayerCardProps {
  id: string;
  title: string;
  volume: number;
  send: number;
  status: 'loading' | 'loaded';
  type: 'synth' | 'freesound' | 'melodic';
  onRemove: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onSendChange: (id: string, send: number) => void;
}

const layerIcons = {
  synth: <Zap className="w-4 h-4" />,
  freesound: <Waves className="w-4 h-4" />,
  melodic: <Music className="w-4 h-4" />,
};

export default function LayerCard({
  id,
  title,
  volume,
  send,
  status,
  type,
  onRemove,
  onVolumeChange,
  onSendChange,
}: LayerCardProps) {
  if (status === 'loading') {
    return (
      <div className="w-64 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-1 font-sans">
        <div className="bg-neutral-500 h-[26px] flex items-center px-1">
           <Skeleton className="h-5 w-full bg-neutral-400" />
        </div>
        <div className="p-4 flex items-center justify-center space-x-4">
          <Skeleton className="h-10 w-10 bg-neutral-400" />
          <Skeleton className="h-10 w-10 bg-neutral-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-1 font-sans">
      {/* Title Bar */}
      <div className="bg-blue-800 text-white flex items-center justify-between p-1">
        <div className="flex items-center gap-2">
          {layerIcons[type]}
          <span className="font-bold text-sm select-none">{title}</span>
        </div>
        <Button
          variant="retro"
          size="icon"
          className="w-5 h-5"
          onClick={() => onRemove(id)}
          aria-label="Close"
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 flex items-center justify-center space-x-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="retro" size="icon" title="Volume">
              <Volume2 />
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
            <Button variant="retro" size="icon" title="FX Send">
              <Send />
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
      </div>
    </div>
  );
}
