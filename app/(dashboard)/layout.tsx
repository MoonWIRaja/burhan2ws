'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme/theme-provider';

interface User {
  id: string;
  phone?: string;
  name?: string;
  role: 'ADMIN' | 'USER' | 'SUBUSER';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'qr_pending'>('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const disconnectCountRef = useRef(0);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/');
          return;
        }

        setUser(data.user);
        setConnectionStatus(data.whatsappStatus || 'disconnected');
        
        // If already disconnected on load, redirect to login
        if (data.whatsappStatus === 'disconnected' || data.whatsappStatus === 'logged_out') {
          router.push('/');
          return;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Check scheduler immediately, then every 10 seconds (very frequent for better accuracy)
    const checkScheduler = async () => {
      try {
        await fetch('/api/scheduler/check');
      } catch (error) {
        console.error('Scheduler check failed:', error);
      }
    };
    
    // Check immediately
    checkScheduler();
    
    // Then check every 10 seconds (very frequent to catch scheduled times accurately)
    const schedulerInterval = setInterval(checkScheduler, 10000);

    // Poll connection status
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        const status = data.status || 'disconnected';
        setConnectionStatus(status);
        
        // Auto logout when disconnected (after 3 consecutive disconnects)
        if (status === 'disconnected' || status === 'logged_out') {
          disconnectCountRef.current++;
          if (disconnectCountRef.current >= 3) {
            console.log('Auto logout: WhatsApp disconnected');
            // Logout and redirect
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/');
          }
        } else {
          disconnectCountRef.current = 0;
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 3000); // Check every 3 seconds

    return () => {
      clearInterval(interval);
      if (schedulerInterval) clearInterval(schedulerInterval);
    };
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg)]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[var(--neon-color-primary)] border-t-transparent rounded-full animate-spin mx-auto" style={{ boxShadow: '0 0 15px var(--neon-glow)' }} />
          <p className="text-[var(--text)] font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          isAdmin={user?.role === 'ADMIN'}
          connectionStatus={connectionStatus}
          userName={user?.name || undefined}
          userPhone={user?.phone || undefined}
        />
        <main className="flex-1 overflow-auto cyber-scrollbar">
          {children}
        </main>
        <Toaster />
      </div>
    </ThemeProvider>
  );
}