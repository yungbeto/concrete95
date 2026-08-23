
'use client';

import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';

interface DesktopIconProps {
  icon?: LucideIcon;
  imageUrl?: string;
  label: string;
  onClick: () => void;
  isOpen?: boolean;
  badge?: boolean;
}

export default function DesktopIcon({
  icon: Icon,
  imageUrl,
  label,
  onClick,
  isOpen,
  badge,
}: DesktopIconProps) {
  return (
    <button
      type="button"
      className={`flex w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-md p-1.5 hover:bg-white/10 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 sm:h-24 sm:w-24 sm:gap-1 sm:p-2 min-h-[4.75rem] sm:min-h-0 ${isOpen ? 'bg-white/15' : ''}`}
      onClick={onClick}
    >
      <span className="relative shrink-0">
        {Icon && <Icon className="h-8 w-8 shrink-0 text-white sm:h-10 sm:w-10" />}
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={label}
            width={40}
            height={40}
            className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
          />
        )}
        {badge && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white/80 bg-[#FF4444] shadow-sm sm:h-3 sm:w-3"
            aria-label="Unread guestbook messages"
          />
        )}
      </span>
      <span className="max-w-[4.5rem] select-none text-center text-[10px] leading-tight text-white sm:max-w-none sm:text-xs">
        {label}
      </span>
      {isOpen && <span className="w-1 h-1 rounded-full bg-white/80" />}
    </button>
  );
}
