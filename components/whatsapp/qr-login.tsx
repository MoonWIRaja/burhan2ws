'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface QRLoginProps {
  qrCode?: string | null;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  onRefresh?: () => void;
  isLoading?: boolean;
}

function StatusIndicatorSimple({ status }: { status: string }) {
  const config = {
    connected: { color: '#44ff44', text: 'Connected', Icon: Wifi },
    disconnected: { color: '#ff4444', text: 'Disconnected', Icon: WifiOff },
    connecting: { color: '#ffff44', text: 'Connecting...', Icon: Loader2 },
    qr_pending: { color: 'var(--neon-color-primary)', text: 'Scan QR Code', Icon: Wifi },
  }[status] || { color: '#ff4444', text: 'Disconnected', Icon: WifiOff };
  
  const Icon = config.Icon;
  
  return (
    <div className="flex items-center gap-2">
      <div 
        className="w-3 h-3 rounded-full animate-pulse"
        style={{ backgroundColor: config.color, boxShadow: `0 0 10px ${config.color}` }}
      />
      <Icon 
        className={`w-5 h-5 ${status === 'connecting' ? 'animate-spin' : ''}`}
        style={{ color: config.color }}
      />
      <span 
        className="font-mono text-sm"
        style={{ color: config.color, textShadow: `0 0 10px ${config.color}` }}
      >
        {config.text}
      </span>
    </div>
  );
}

export function QRLogin({ qrCode, status, onRefresh, isLoading }: QRLoginProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="qr-box-neon max-w-md w-full text-center space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold font-cyber uppercase tracking-wider neon-text-animated">
            BurHan2Ws
          </h2>
          <p className="text-[var(--text-dim)] font-mono text-sm">
            WhatsApp Automation Platform
          </p>
        </div>

        {/* Status */}
        <div className="flex justify-center">
          <StatusIndicatorSimple status={status} />
        </div>

        {/* QR Code Container */}
        <div className="relative">
          {status === 'qr_pending' && qrCode ? (
            <div className="bg-white p-4 rounded-lg inline-block">
              <div 
                className="w-64 h-64 flex items-center justify-center"
                dangerouslySetInnerHTML={{ 
                  __html: qrCode.startsWith('<svg') 
                    ? qrCode 
                    : `<img src="${qrCode}" alt="QR Code" class="w-full h-full" />`
                }}
              />
            </div>
          ) : status === 'connecting' ? (
            <div className="w-64 h-64 flex items-center justify-center neon-border rounded-lg mx-auto">
              <div className="text-center space-y-4">
                <RefreshCw className="w-12 h-12 mx-auto neon-text animate-spin" />
                <p className="text-[var(--text-dim)] font-mono text-sm">
                  Connecting...
                </p>
              </div>
            </div>
          ) : status === 'connected' ? (
            <div className="w-64 h-64 flex items-center justify-center neon-border rounded-lg mx-auto" style={{ borderColor: 'var(--neon-green)' }}>
              <div className="text-center space-y-4">
                <Smartphone className="w-12 h-12 mx-auto" style={{ color: 'var(--neon-green)' }} />
                <p 
                  className="font-mono"
                  style={{ color: 'var(--neon-green)', textShadow: '0 0 10px var(--neon-green)' }}
                >
                  Connected!
                </p>
              </div>
            </div>
          ) : (
            <div className="w-64 h-64 flex items-center justify-center neon-border rounded-lg mx-auto">
              <div className="text-center space-y-4">
                <Smartphone className="w-12 h-12 mx-auto neon-text opacity-50" />
                <p className="text-[var(--text-dim)] font-mono text-sm">
                  Click refresh to generate QR
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="space-y-3 text-left">
          <p className="text-[var(--text-dim)] font-mono text-xs">
            <span className="neon-text">1.</span> Open WhatsApp on your phone
          </p>
          <p className="text-[var(--text-dim)] font-mono text-xs">
            <span className="neon-text">2.</span> Tap Menu or Settings → Linked Devices
          </p>
          <p className="text-[var(--text-dim)] font-mono text-xs">
            <span className="neon-text">3.</span> Tap on Link a Device
          </p>
          <p className="text-[var(--text-dim)] font-mono text-xs">
            <span className="neon-text">4.</span> Point your phone at this screen
          </p>
        </div>

        {/* Refresh Button */}
        <Button
          variant="neon"
          onClick={onRefresh}
          disabled={isLoading || status === 'connecting'}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh QR Code
            </>
          )}
        </Button>

        {/* Admin Link */}
        <p className="text-[var(--text-dim)] font-mono text-xs">
          Admin? <a href="/login/admin:admin" className="neon-text hover:underline">Login here</a>
        </p>
      </div>
    </div>
  );
}

export default QRLogin;



