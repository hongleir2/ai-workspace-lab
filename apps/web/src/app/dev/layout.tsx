import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-amber-500/30 bg-amber-500/5">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <span className="font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400">
            development tools
          </span>
          <span className="text-muted-foreground">
            disabled outside <code className="font-mono">NODE_ENV=development</code>
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
