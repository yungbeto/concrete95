
'use client';

import type { LucideIcon } from 'lucide-react';

interface DesktopIconProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export default function DesktopIcon({
  icon: Icon,
  label,
  onClick,
}: DesktopIconProps) {
  return (
    <button
      className="flex flex-col items-center justify-center w-24 h-24 gap-1 p-2 rounded-md hover:bg-white/10 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
      onClick={onClick}
    >
      <Icon className="w-10 h-10 text-white" />
      <span className="text-xs text-white text-center select-none">{label}</span>
    </button>
  );
}
