'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Smartphone, Wifi, WifiOff, Loader2 } from 'lucide-react';

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { color: string; text: string; Icon: typeof Wifi }> = {
    connected: { color: '#44ff44', text: 'Connected', Icon: Wifi },
    disconnected: { color: '#ff4444', text: 'Disconnected', Icon: WifiOff },
    connecting: { color: '#ffff44', text: 'Connecting...', Icon: Loader2 },
    qr_pending: { color: 'var(--neon-color-primary)', text: 'Scan QR Code', Icon: Wifi },
  };
  
  const { color, text, Icon } = config[status] || config.disconnected;
  
  return (
    <div className="flex items-center gap-2">
      <div 
        className="w-3 h-3 rounded-full animate-pulse"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
      />
      <Icon 
        className={`w-5 h-5 ${status === 'connecting' ? 'animate-spin' : ''}`}
        style={{ color }}
      />
      <span className="font-mono text-sm" style={{ color, textShadow: `0 0 10px ${color}` }}>
        {text}
      </span>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'qr_pending'>('connecting');
  const [countdown, setCountdown] = useState(180); // 3 minutes
  const [userPhone, setUserPhone] = useState<string | null>(null);
  
  const hasInitRef = useRef(false);
  const isConnectedRef = useRef(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch QR code
  const fetchQR = async () => {
    try {
      const res = await fetch('/api/whatsapp/qr', { method: 'POST' });
      const data = await res.json();
      
      console.log('QR response:', data.status);
      
      if (data.status === 'connected') {
        isConnectedRef.current = true;
        setStatus('connected');
        setTimeout(() => router.push('/dashboard'), 1500);
        return true;
      }
      
      if (data.qr) {
        setQrCode(data.qr);
        setStatus('qr_pending');
        setCountdown(180); // Reset countdown to 3 minutes
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to fetch QR:', error);
      return false;
    }
  };

  // Check connection status only
  const checkStatus = async () => {
    if (isConnectedRef.current) return;
    
    try {
      const res = await fetch('/api/whatsapp/check');
      const data = await res.json();
      
      if (data.status === 'connected') {
        console.log('Connected!', data.merged ? '(merged user)' : '');
        isConnectedRef.current = true;
        setStatus('connected');
        // Redirect to dashboard
        setTimeout(() => router.push('/dashboard'), 1000);
      }
    } catch (error) {
      // Ignore
    }
  };

  // Initialize on mount
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;

    const init = async () => {
      // Check existing session first
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        
        if (data.authenticated && data.whatsappStatus === 'connected') {
          setStatus('connected');
          router.push('/dashboard');
          return;
        }
        
        if (data.user?.phone) {
          setUserPhone(data.user.phone);
        }
      } catch (e) {
        // Ignore
      }

      // Fetch initial QR
      setStatus('connecting');
      const connected = await fetchQR();
      
      if (!connected) {
        // Start polling for connection status
        pollRef.current = setInterval(checkStatus, 2000);
        
        // Start countdown (3 minutes = 180 seconds)
        countdownRef.current = setInterval(() => {
          setCountdown(c => {
            if (c <= 1) {
              // Refresh QR when countdown reaches 0
              fetchQR();
              return 180; // Reset to 3 minutes
            }
            return c - 1;
          });
        }, 1000);
      }
    };

    init();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [router]);

  // Stop intervals when connected
  useEffect(() => {
    if (status === 'connected') {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [status]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="qr-box-neon max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-wider neon-text-animated" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            BurHan2Ws
          </h2>
          <p className="text-[var(--text-dim)] font-mono text-sm">
            WhatsApp Automation Platform
          </p>
          {userPhone && (
            <p className="text-[var(--neon-color-primary)] font-mono text-xs">
              Welcome back! (+{userPhone})
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <StatusIndicator status={status} />
        </div>

        <div className="relative">
          {status === 'qr_pending' && qrCode ? (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg inline-block">
                <div 
                  className="w-64 h-64 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: qrCode }}
                />
              </div>
              <p className="text-[var(--text-dim)] font-mono text-xs">
                QR refresh dalam <span className="neon-text">{Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
              </p>
            </div>
          ) : status === 'connecting' ? (
            <div className="w-64 h-64 flex items-center justify-center neon-border rounded-lg mx-auto">
              <div className="text-center space-y-4">
                <RefreshCw className="w-12 h-12 mx-auto neon-text animate-spin" />
                <p className="text-[var(--text-dim)] font-mono text-sm">
                  {userPhone ? 'Reconnecting...' : 'Generating QR...'}
                </p>
              </div>
            </div>
          ) : status === 'connected' ? (
            <div className="w-64 h-64 flex items-center justify-center rounded-lg mx-auto" style={{ border: '1px solid #00ff88' }}>
              <div className="text-center space-y-4">
                <Smartphone className="w-12 h-12 mx-auto" style={{ color: '#00ff88' }} />
                <p className="font-mono" style={{ color: '#00ff88', textShadow: '0 0 10px #00ff88' }}>Connected!</p>
                <p className="text-[var(--text-dim)] font-mono text-xs">Redirecting...</p>
              </div>
            </div>
          ) : (
            <div className="w-64 h-64 flex items-center justify-center neon-border rounded-lg mx-auto">
              <div className="text-center space-y-4">
                <RefreshCw className="w-12 h-12 mx-auto neon-text animate-spin" />
                <p className="text-[var(--text-dim)] font-mono text-sm">Loading...</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 text-left">
          <p className="text-[var(--text-dim)] font-mono text-xs"><span className="neon-text">1.</span> Open WhatsApp on your phone</p>
          <p className="text-[var(--text-dim)] font-mono text-xs"><span className="neon-text">2.</span> Tap Menu or Settings → Linked Devices</p>
          <p className="text-[var(--text-dim)] font-mono text-xs"><span className="neon-text">3.</span> Tap on Link a Device</p>
          <p className="text-[var(--text-dim)] font-mono text-xs"><span className="neon-text">4.</span> Point your phone at this screen</p>
        </div>

        <p className="text-[var(--text-dim)] font-mono text-xs">
          Admin? <a href="/login/admin:admin" className="neon-text hover:underline">Login here</a>
        </p>
      </div>
    </div>
  );
}

