
'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Activity } from 'lucide-react';
import type { AudioEngineHandle } from './AudioEngine';

interface LissajousWindowProps {
  audioEngineRef: React.RefObject<AudioEngineHandle>;
  position: { x: number; y: number };
  zIndex: number;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

const CANVAS_SIZE = 192;

export default function LissajousWindow({
  audioEngineRef,
  position,
  zIndex,
  onClose,
  onMouseDown,
  onTouchStart,
}: LissajousWindowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initial phosphor background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    let animId: number;
    let lastTime = 0;
    const FRAME_INTERVAL = 1000 / 30; // 30 fps

    const draw = (ts: number) => {
      animId = requestAnimationFrame(draw);
      if (ts - lastTime < FRAME_INTERVAL) return;
      lastTime = ts;

      // Phosphor-style fade: semi-transparent black overlay decays the trail
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const data = audioEngineRef.current?.getLissajousData?.();
      if (!data) return;

      const { left, right } = data;
      const len = left.length;
      const cx = CANVAS_SIZE / 2;
      const cy = CANVAS_SIZE / 2;
      const scale = (CANVAS_SIZE / 2) * 0.88;

      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#39FF14';

      for (let i = 0; i < len; i++) {
        // X axis = left channel, Y axis = right channel (inverted so +Y is up)
        const x = cx + left[i] * scale;
        const y = cy - right[i] * scale;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [audioEngineRef]);

  return (
    <div
      className="bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute select-none"
      style={{ left: `${position.x}px`, top: `${position.y}px`, zIndex, width: '220px' }}
    >
      {/* Title bar */}
      <div
        className="bg-blue-800 text-white flex items-center justify-between p-1 cursor-move"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4" />
          <span className="font-bold text-sm">Scope.exe</span>
        </div>
        <Button
          variant="retro"
          size="icon"
          className="w-5 h-5"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* Canvas area */}
      <div
        className="p-2"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="block"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        <p className="text-xs text-neutral-600 mt-1 text-center">L ↔ R Lissajous</p>
      </div>
    </div>
  );
}
