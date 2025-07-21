
'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface InfoWindowProps {
  title: string;
  position: { x: number; y: number };
  zIndex: number;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  children: React.ReactNode;
}

export default function InfoWindow({
  title,
  position,
  zIndex,
  onClose,
  onMouseDown,
  onTouchStart,
  children,
}: InfoWindowProps) {
  const windowStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: zIndex,
  };

  return (
    <div
      className="w-80 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute"
      style={windowStyle}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      {/* Title Bar */}
      <div className="bg-blue-800 text-white flex items-center justify-between p-1 cursor-move">
        <span className="font-bold text-sm select-none">{title}</span>
        <Button
          variant="retro"
          size="icon"
          className="w-5 h-5"
          onClick={(e) => {
            e.stopPropagation(); // Prevent drag from starting
            onClose();
          }}
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()} // Prevent drag
          onTouchStart={(e) => e.stopPropagation()} // Prevent drag on touch
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* Content */}
      <div
        className="p-0"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <ScrollArea className="max-h-[70vh] w-full">
            <div className="p-4">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
