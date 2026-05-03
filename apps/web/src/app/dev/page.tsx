import { PageHeader } from '@/components/ui/page-header';
import Link from 'next/link';

const tools = [
  {
    href: '/dev/design-system',
    title: 'Design system',
    description: 'Preview all UI primitives in light + dark mode.',
    sprint: '0–5',
  },
  {
    href: '/dev/sentry-test',
    title: 'Sentry test',
    description: 'Trigger a captured error to verify Sentry wiring.',
    sprint: '5',
  },
  {
    href: '/dev/feature-flags',
    title: 'Feature flags',
    description: 'Inspect and toggle local feature flag overrides.',
    sprint: '5',
  },
  {
    href: '/dev/auth-state',
    title: 'Auth state',
    description: 'Inspect the current user, organization, and session.',
    sprint: '1',
  },
  {
    href: '/dev/env',
    title: 'Env debug',
    description: 'Validate non-secret environment variables.',
    sprint: '0',
  },
];

export default function DevToolsIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Developer tools"
        description="Local-only utilities for inspecting and debugging the app."
      />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="group block rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-base font-semibold tracking-tight">
                  {tool.title}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  sprint {tool.sprint}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
