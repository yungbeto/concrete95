
'use client';

import { cn } from '@/lib/utils';
import React from 'react';
import { cva, type VariantProps } from "class-variance-authority"

const fieldsetVariants = cva(
  "relative p-4 pt-4 border-2 border-l-neutral-500 border-t-neutral-500 border-r-white border-b-white",
  {
    variants: {
      variant: {
        default: "bg-silver text-black",
        warning: "bg-yellow-200 text-yellow-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface FieldsetProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof fieldsetVariants> {
  label: string;
  children: React.ReactNode;
}


export default function Fieldset({ label, children, className, variant }: FieldsetProps) {
  const spanBgClass = variant === 'warning' ? 'bg-yellow-200' : 'bg-silver';

  return (
    <div className={cn(fieldsetVariants({ variant }), className)}>
      <span className={cn("absolute -top-2.5 left-2 px-1 text-sm", spanBgClass)}>
        {label}
      </span>
      {children}
    </div>
  );
}
