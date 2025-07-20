
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
      className="flex flex-col items-center justify-center w-24 h-24 gap-1 p-2 rounded-md hover:bg-white/10 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
      onClick={onClick}
    >
      {Icon && <Icon className="w-10 h-10 text-white" />}
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={label}
          width={40}
          height={40}
          className="object-contain"
        />
      )}
      <span className="text-xs text-white text-center select-none">{label}</span>
    </button>
  );
}
