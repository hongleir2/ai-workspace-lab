import Link from 'next/link';
import type { ReactNode } from 'react';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-mesh-fade" />
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 transition-colors hover:opacity-80">
            <div
              aria-hidden
              className="h-7 w-7 rounded-md bg-gradient-to-br from-primary/80 to-primary"
            />
            <span className="font-display text-base font-semibold tracking-tight">
              AI Workspace
            </span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            getting started
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 px-6 py-12">
        {children}
      </main>
    </div>
  );
}
