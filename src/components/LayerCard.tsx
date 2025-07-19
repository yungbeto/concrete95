
'use client';

import { Button } from '@/components/ui/button';
import { Play, Square, X, Zap, Waves, Music } from 'lucide-react';
import LayerMenuBar from './LayerMenuBar';
import { type AudioEngineHandle } from './AudioEngine';
import * as Tone from 'tone';
import { useRef, useEffect } from 'react';

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
  audioEngineRef: React.RefObject<AudioEngineHandle>;
  node: Tone.Player | Tone.Sequence | null;
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


function SoundRecorderDisplay({
    audioEngineRef,
    node,
}: {
    audioEngineRef: React.RefObject<AudioEngineHandle>;
    node: Tone.Player | Tone.Sequence | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      if (!audioEngineRef.current || !node) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }
      
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
    <div className="flex flex-col gap-2 p-2" onMouseDown={(e) => e.stopPropagation()}>
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
  audioEngineRef,
  node,
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
  const isTransportDisabled = isLoading;

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

      <SoundRecorderDisplay audioEngineRef={audioEngineRef} node={node} />
      
      {/* Separator */}
      <div className="h-[2px] w-full bg-silver border-t-neutral-500 border-b-white" />

      {/* Control Buttons */}
       <div className="p-2 w-full flex items-center justify-center space-x-2" onMouseDown={(e) => e.stopPropagation()}>
         <Button className="w-full" variant="retro" size="icon" title="Play" onClick={() => onPlay(id)} disabled={isTransportDisabled}>
           <Play className="text-black" fill="black" />
         </Button>
         <Button className="w-full" variant="retro" size="icon" title="Stop" onClick={() => onStop(id)} disabled={isTransportDisabled}>
           <Square className="text-black" fill="black" />
         </Button>
       </div>
    </div>
  );
}
