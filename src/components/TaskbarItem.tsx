
'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface TaskbarItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export default function TaskbarItem({
  icon: Icon,
  label,
  isActive,
  onClick,
}: TaskbarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 h-7 px-2 text-sm text-black select-none truncate w-40 justify-start',
        'border-2 !rounded-none',
        isActive 
          ? 'bg-neutral-300 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white' 
          : 'bg-silver border-t-white border-l-white border-r-neutral-500 border-b-neutral-500',
        'active:border-t-neutral-500 active:border-l-neutral-500 active:border-r-white active:border-b-white'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
