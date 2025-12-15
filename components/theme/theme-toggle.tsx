'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils/cn';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 rounded-lg neon-border bg-[var(--panel)]">
        <div className="h-8 w-8 rounded-md animate-pulse bg-[var(--panel)]" />
        <div className="h-8 w-8 rounded-md animate-pulse bg-[var(--panel)]" />
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark' || theme === 'dark';

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    // Save to localStorage (per-device)
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg neon-border bg-[var(--panel)] shadow-lg">
      {/* Dark Mode Button */}
      <button
        onClick={() => handleThemeChange('dark')}
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-md',
          'transition-all duration-300 ease-in-out',
          'hover:scale-110 active:scale-95',
          isDark
            ? 'bg-[var(--neon-color-primary)] text-[var(--bg)] shadow-[0_0_15px_var(--neon-color-primary)]'
            : 'text-[var(--text-dim)] hover:text-[var(--neon-color-primary)] hover:bg-[var(--panel)]'
        )}
        title="Dark Mode"
      >
        <Moon className={cn('h-4 w-4 transition-all', isDark && 'animate-pulse')} />
        {isDark && (
          <span className="absolute inset-0 rounded-md bg-[var(--neon-color-primary)] opacity-20 animate-ping" />
        )}
      </button>

      {/* Light Mode Button */}
      <button
        onClick={() => handleThemeChange('light')}
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-md',
          'transition-all duration-300 ease-in-out',
          'hover:scale-110 active:scale-95',
          !isDark
            ? 'bg-[var(--neon-color-primary)] text-[var(--bg)] shadow-[0_0_15px_var(--neon-color-primary)]'
            : 'text-[var(--text-dim)] hover:text-[var(--neon-color-primary)] hover:bg-[var(--panel)]'
        )}
        title="Light Mode"
      >
        <Sun className={cn('h-4 w-4 transition-all', !isDark && 'animate-spin-slow')} />
        {!isDark && (
          <span className="absolute inset-0 rounded-md bg-[var(--neon-color-primary)] opacity-20 animate-ping" />
        )}
      </button>
    </div>
  );
}

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-1 rounded-lg neon-border bg-[var(--panel)]">
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300',
          theme === 'dark'
            ? 'bg-[var(--neon-color-primary)] text-[var(--bg)]'
            : 'text-[var(--text-dim)] hover:text-[var(--neon-color-primary)]'
        )}
      >
        <Moon className="h-4 w-4" />
        <span className="text-sm font-mono">Dark</span>
      </button>
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300',
          theme === 'light'
            ? 'bg-[var(--neon-color-primary)] text-[var(--bg)]'
            : 'text-[var(--text-dim)] hover:text-[var(--neon-color-primary)]'
        )}
      >
        <Sun className="h-4 w-4" />
        <span className="text-sm font-mono">Light</span>
      </button>
      <button
        onClick={() => setTheme('system')}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300',
          theme === 'system'
            ? 'bg-[var(--neon-color-primary)] text-[var(--bg)]'
            : 'text-[var(--text-dim)] hover:text-[var(--neon-color-primary)]'
        )}
      >
        <Monitor className="h-4 w-4" />
        <span className="text-sm font-mono">System</span>
      </button>
    </div>
  );
}