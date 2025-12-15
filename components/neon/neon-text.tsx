'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface NeonTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  animated?: boolean;
  glow?: 'sm' | 'md' | 'lg';
}

export function NeonText({
  children,
  className,
  as: Component = 'span',
  animated = false,
  glow = 'md',
  ...props
}: NeonTextProps) {
  const glowStyles = {
    sm: 'text-shadow: 0 0 5px var(--neon-color-primary)',
    md: 'text-shadow: 0 0 5px var(--neon-color-primary), 0 0 10px var(--neon-color-primary)',
    lg: 'text-shadow: 0 0 5px var(--neon-color-primary), 0 0 10px var(--neon-color-primary), 0 0 20px var(--neon-color-primary)',
  };

  return (
    <Component
      className={cn(
        'neon-text',
        animated && 'neon-text-animated',
        className
      )}
      style={{ textShadow: glowStyles[glow] }}
      {...props}
    >
      {children}
    </Component>
  );
}

export function NeonTitle({
  children,
  className,
  level = 1,
  animated = true,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  animated?: boolean;
} & React.HTMLAttributes<HTMLHeadingElement>) {
  const sizes = {
    1: 'text-4xl md:text-5xl lg:text-6xl',
    2: 'text-3xl md:text-4xl',
    3: 'text-2xl md:text-3xl',
    4: 'text-xl md:text-2xl',
    5: 'text-lg md:text-xl',
    6: 'text-base md:text-lg',
  };

  const Component = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <Component
      className={cn(
        'font-cyber font-bold tracking-wider uppercase',
        sizes[level],
        animated ? 'neon-text-animated' : 'neon-text',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}



