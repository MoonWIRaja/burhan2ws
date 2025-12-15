'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface NeonBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
  glow?: boolean;
  variant?: 'default' | 'card' | 'panel' | 'terminal';
}

export function NeonBox({
  children,
  className,
  animated = false,
  glow = true,
  variant = 'default',
  ...props
}: NeonBoxProps) {
  const variants = {
    default: 'neon-border rounded-lg p-4',
    card: 'neon-card p-6',
    panel: 'glass-panel p-4',
    terminal: 'bg-black/90 border border-[var(--neon-color-primary)] rounded-lg p-4 font-mono',
  };

  return (
    <div
      className={cn(
        variants[variant],
        animated && 'neon-border-animated',
        glow && 'shadow-neon-sm hover:shadow-neon-md transition-shadow duration-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}



