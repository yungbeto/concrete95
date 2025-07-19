
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
  synth: <Zap className="w-4 h-4 mr-2" />,
  freesound: <Waves className="w-4 h-4 mr-2" />,
  melodic: <Music className="w-4 h-4 mr-2" />,
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
        <Card className="w-64 bg-card/80 backdrop-blur-sm shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center">
                    {layerIcons[type]}
                    <Skeleton className="h-5 w-24" />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => onRemove(id)}
                >
                    <X className="w-4 h-4" />
                </Button>
            </CardHeader>
            <CardContent className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <Skeleton className="h-10 w-10 rounded-md" />
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="w-64 bg-card/80 backdrop-blur-sm shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
            {layerIcons[type]}
            {title}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6"
          onClick={() => onRemove(id)}
          disabled={status === 'loading'}
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex items-center space-x-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Volume" disabled={status === 'loading'}>
              <Volume2 />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
             <p className="text-xs text-muted-foreground mb-2">Volume: {volume > -40 ? `${volume.toFixed(0)} dB` : 'Muted'}</p>
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
            <Button variant="outline" size="icon" title="FX Send" disabled={status === 'loading'}>
              <Send />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
             <p className="text-xs text-muted-foreground mb-2">Send: {send > -40 ? `${send.toFixed(0)} dB` : 'Muted'}</p>
            <Slider
              defaultValue={[send]}
              max={10}
              min={-40}
              step={1}
              onValueeChange={(value) => onSendChange(id, value[0])}
            />
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
