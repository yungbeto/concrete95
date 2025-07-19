
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
import { Volume2, X, Send } from 'lucide-react';

interface LayerCardProps {
  id: string;
  title: string;
  volume: number;
  send: number;
  onRemove: (id: string) => void;
  onVolumeChange: (id: string, volume: number) => void;
  onSendChange: (id: string, send: number) => void;
}

export default function LayerCard({
  id,
  title,
  volume,
  send,
  onRemove,
  onVolumeChange,
  onSendChange,
}: LayerCardProps) {
  return (
    <Card className="w-64 bg-card/80 backdrop-blur-sm shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Volume">
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
            <Button variant="outline" size="icon" title="FX Send">
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
              onValueChange={(value) => onSendChange(id, value[0])}
            />
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
