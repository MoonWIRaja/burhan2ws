'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  phoneNumber?: string; // Phone number to show when connected
}

export function StatusIndicator({
  status,
  showIcon = true,
  showText = true,
  size = 'md',
  className,
  phoneNumber,
}: StatusIndicatorProps) {
  const statusConfig = {
    connected: {
      color: 'text-[#44ff44]',
      glow: 'shadow-[0_0_10px_#44ff44]',
      text: phoneNumber || 'Connected', // Show phone number when connected
      icon: Wifi,
      animate: false,
    },
    disconnected: {
      color: 'text-[#ff4444]',
      glow: 'shadow-[0_0_10px_#ff4444]',
      text: 'Disconnected',
      icon: WifiOff,
      animate: true,
    },
    connecting: {
      color: 'text-[#ffff44]',
      glow: 'shadow-[0_0_10px_#ffff44]',
      text: 'Connecting...',
      icon: Loader2,
      animate: true,
    },
    qr_pending: {
      color: 'text-[var(--neon-color-primary)]',
      glow: 'shadow-[0_0_10px_var(--neon-glow)]',
      text: 'Scan QR Code',
      icon: Wifi,
      animate: true,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  const sizes = {
    sm: { dot: 'w-2 h-2', icon: 'w-3 h-3', text: 'text-xs' },
    md: { dot: 'w-3 h-3', icon: 'w-4 h-4', text: 'text-sm' },
    lg: { dot: 'w-4 h-4', icon: 'w-5 h-5', text: 'text-base' },
  };

  return (
    <div className={cn('flex items-center gap-2', !showText && 'justify-center', className)}>
      {/* WiFi Icon - Server Status Indicator */}
      {showIcon && (
        <Icon
          className={cn(
            sizes[size].icon,
            config.color,
            status === 'connecting' && 'animate-spin'
          )}
        />
      )}

      {showText && (
        <span
          className={cn(
            'font-mono',
            sizes[size].text,
            config.color,
            config.animate && 'animate-pulse'
          )}
          style={{
            textShadow: `0 0 10px currentColor`,
          }}
        >
          {config.text}
        </span>
      )}
    </div>
  );
}

export function DisconnectedBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/95 border-b border-[#ff4444] p-3">
      <div className="container mx-auto flex items-center justify-center gap-3">
        <div className="w-3 h-3 rounded-full bg-[#ff4444] animate-pulse shadow-[0_0_10px_#ff4444]" />
        <span 
          className="font-mono text-[#ff4444] animate-pulse"
          style={{ textShadow: '0 0 10px #ff4444' }}
        >
          Disconnected – awaiting reconnection
        </span>
      </div>
    </div>
  );
}



