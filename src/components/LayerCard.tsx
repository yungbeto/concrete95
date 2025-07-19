
'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, StopCircle, X, Zap, Waves, Music } from 'lucide-react';
import LayerMenuBar from './LayerMenuBar';

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
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
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
        <div className="flex-grow h-auto bg-black border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white flex items-center justify-center p-1">
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
  onPlay,
  onStop,
}: LayerCardProps) {
  const cardStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: zIndex,
  };
  const isLoading = status === 'loading';
  const isTransportDisabled = isLoading || type !== 'freesound';

  return (
    <div 
      className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute select-none"
      style={cardStyle}
    >
        {/* Title Bar */}
        <div 
            className="bg-blue-800 text-white flex items-center justify-between p-1 cursor-move"
            onMouseDown={onMouseDown}
        >
            <div className="flex items-center gap-1">
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

        {/* Menu Bar */}
        <div onMouseDown={(e) => e.stopPropagation()}>
            <LayerMenuBar
                type={type}
                volume={volume}
                send={send}
                playbackRate={playbackRate}
                onVolumeChange={(value) => onVolumeChange(id, value)}
                onSendChange={(value) => onSendChange(id, value)}
                onPlaybackRateChange={(value) => onPlaybackRateChange(id, value)}
            />
        </div>


      {/* Sound Recorder Display */}
      <SoundRecorderDisplay isLoading={isLoading} />
      
      {/* Separator */}
      <div className="h-[2px] w-full bg-silver border-t-neutral-500 border-b-white" />

      {/* Control Buttons */}
       <div className="p-2 flex items-center justify-center space-x-2" onMouseDown={(e) => e.stopPropagation()}>
         <Button variant="retro" size="icon" title="Play" onClick={() => onPlay(id)} disabled={isTransportDisabled}>
           <Play className="text-black" />
         </Button>
         <Button variant="retro" size="icon" title="Stop" onClick={() => onStop(id)} disabled={isTransportDisabled}>
           <StopCircle className="text-black" />
         </Button>
       </div>
    </div>
  );
}
