
'use client';

import { cn } from '@/lib/utils';
import React from 'react';

interface FieldsetProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function Fieldset({ label, children, className }: FieldsetProps) {
  return (
    <div className={cn("relative p-4 pt-2 border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white", className)}>
      <span className="absolute -top-2.5 left-2 px-1 bg-silver text-sm">
        {label}
      </span>
      {children}
    </div>
  );
}
