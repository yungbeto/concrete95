
'use client';

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  const windowStyle = isMobile
    ? { zIndex }
    : { left: `${position.x}px`, top: `${position.y}px`, zIndex };

  return (
    <div
      className={
        isMobile
          ? 'fixed inset-0 w-full h-dvh bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans flex flex-col'
          : 'w-80 h-auto bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 p-0 font-sans absolute flex flex-col'
      }
      style={windowStyle}
      onMouseDown={isMobile ? undefined : onMouseDown}
      onTouchStart={isMobile ? undefined : onTouchStart}
    >
      {/* Title Bar */}
      <div className={`bg-blue-800 text-white flex items-center justify-between p-1 h-7 flex-shrink-0 ${isMobile ? '' : 'cursor-move'}`}>
        <span className="font-bold text-sm select-none">{title}</span>
        <Button
          variant="retro"
          size="icon"
          className="w-5 h-5"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <X className="w-3 h-3 text-black" />
        </Button>
      </div>

      {/* Content */}
      <div
        className={`p-4 ${isMobile ? 'overflow-y-auto flex-1' : 'overflow-y-auto max-h-[calc(100vh-8rem)]'}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
