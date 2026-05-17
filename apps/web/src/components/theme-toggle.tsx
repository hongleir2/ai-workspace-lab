'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span className="flex items-center gap-2">
        <Moon className="h-4 w-4" />
        <span>Dark mode</span>
      </span>
    );
  }

  const isDark = theme === 'dark';

  return (
    <span className="flex items-center gap-2">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDark ? 'Switch to light' : 'Switch to dark'}</span>
    </span>
  );
}

export function useThemeToggle() {
  const { theme, setTheme } = useTheme();
  return () => setTheme(theme === 'dark' ? 'light' : 'dark');
}
