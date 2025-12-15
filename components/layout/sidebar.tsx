'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { StatusIndicator } from '@/components/neon/status-indicator';
import { NeonTitle } from '@/components/neon/neon-text';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Send,
  Bot,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  isAdmin?: boolean;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  userName?: string;
  userPhone?: string;
}

const menuItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/blast', icon: Send, label: 'Blast' },
  { href: '/bot', icon: Bot, label: 'Bot Automation' },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '/chat', icon: MessageSquare, label: 'Chat' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const adminItems = [
  { href: '/admin', icon: Shield, label: 'Admin Panel' },
];

function Sidebar({
  isAdmin = false,
  connectionStatus = 'disconnected',
  userName,
  userPhone,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        'sidebar-neon h-screen flex flex-col transition-all duration-300 neon-shift',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--neon-color-primary)]/30">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <NeonTitle level={4} animated className="truncate">
              BurHan2Ws
            </NeonTitle>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="neon-hover"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 neon-text" />
            ) : (
              <ChevronLeft className="h-4 w-4 neon-text" />
            )}
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className={cn(
        "p-4 border-b border-[var(--neon-color-primary)]/30",
        collapsed && "flex items-center justify-center"
      )}>
        <StatusIndicator
          status={connectionStatus}
          showIcon={true}
          showText={!collapsed}
          size="sm"
          phoneNumber={connectionStatus === 'connected' ? userPhone : undefined}
          className={collapsed ? "justify-center" : ""}
        />
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300',
                  'hover:bg-[var(--neon-color-primary)]/10 hover:shadow-neon-sm',
                  isActive && 'bg-[var(--neon-color-primary)]/20 shadow-neon-sm neon-border',
                  collapsed && 'justify-center'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive ? 'neon-text' : 'text-[var(--text-dim)]'
                  )}
                />
                {!collapsed && (
                  <span
                    className={cn(
                      'font-mono text-sm',
                      isActive ? 'neon-text' : 'text-[var(--text-dim)]'
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Admin Items */}
          {isAdmin && (
            <>
              <div className="my-4 border-t border-[var(--neon-color-primary)]/30" />
              {adminItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                return (
              <Link
                    key={item.href}
                    href={item.href}
                prefetch={false}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300',
                      'hover:bg-[var(--neon-color-secondary)]/10 hover:shadow-neon-sm',
                      isActive && 'bg-[var(--neon-color-secondary)]/20 shadow-neon-sm',
                      collapsed && 'justify-center'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 transition-colors',
                        isActive ? 'text-[var(--neon-color-secondary)]' : 'text-[var(--text-dim)]'
                      )}
                    />
                    {!collapsed && (
                      <span
                        className={cn(
                          'font-mono text-sm',
                          isActive ? 'text-[var(--neon-color-secondary)]' : 'text-[var(--text-dim)]'
                        )}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </ScrollArea>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--neon-color-primary)]/30">
          <div className={cn('flex gap-2', collapsed ? 'flex-col items-center' : 'justify-center')}>
            <ThemeToggle />
            {/* Only show Settings button for admin */}
            {isAdmin && (
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="neon-hover">
                  <Settings className="h-5 w-5 text-[var(--text-dim)] hover:neon-text" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="neon-hover"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/';
              }}
            >
              <LogOut className="h-5 w-5 text-[var(--text-dim)] hover:text-[var(--neon-red)]" />
            </Button>
          </div>
        </div>
    </aside>
  );
}

export { Sidebar };
export default Sidebar;



