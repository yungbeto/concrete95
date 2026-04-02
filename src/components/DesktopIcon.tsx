
'use client';

import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';

interface DesktopIconProps {
  icon?: LucideIcon;
  imageUrl?: string;
  label: string;
  onClick: () => void;
}

export default function DesktopIcon({
  icon: Icon,
  imageUrl,
  label,
  onClick,
}: DesktopIconProps) {
  return (
    <button
      type="button"
      className="flex w-[4.75rem] flex-col items-center justify-center gap-0.5 rounded-md p-1.5 hover:bg-white/10 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 sm:h-24 sm:w-24 sm:gap-1 sm:p-2 min-h-[4.75rem] sm:min-h-0"
      onClick={onClick}
    >
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
      <span className="max-w-[4.5rem] select-none text-center text-[10px] leading-tight text-white sm:max-w-none sm:text-xs">
        {label}
      </span>
    </button>
  );
}
