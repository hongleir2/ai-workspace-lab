'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex gap-3">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
            theme === value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-foreground'
          }`}
        >
          <Icon className="h-5 w-5" />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
