'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { DisconnectedBanner } from '@/components/neon/status-indicator';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';

interface HeaderProps {
  title: string;
  subtitle?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  actions?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  connectionStatus = 'connected',
  showSearch = false,
  onSearch,
  actions,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <>
      {connectionStatus === 'disconnected' && <DisconnectedBanner />}
      
      <header
        className={cn(
          'sticky top-0 z-40 glass-panel border-b border-[var(--neon-color-primary)]/30 px-6 py-4',
          connectionStatus === 'disconnected' && 'mt-12'
        )}
      >
        <div className="flex items-center justify-between">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-cyber font-bold neon-text">{title}</h1>
            {subtitle && (
              <p className="text-sm text-[var(--text-dim)] font-mono">{subtitle}</p>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* Search */}
            {showSearch && (
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-dim)]" />
                <Input
                  variant="neon"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </form>
            )}

            {/* Notifications */}
            <NotificationDropdown />

            {/* Additional Actions */}
            {actions}
          </div>
        </div>
      </header>
    </>
  );
}



