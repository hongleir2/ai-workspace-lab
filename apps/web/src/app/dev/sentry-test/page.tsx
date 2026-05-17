import { PageHeader } from '@/components/ui/page-header';
import { ClientErrorButton, ServerErrorButton } from './client-test-button';

export default function SentryTestPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <PageHeader
        title="Sentry test"
        description="Development-only checks for client and server error capture."
      />

      <section className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {'Client runtime'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {'Throws from the browser so the root error boundary captures it.'}
          </p>
          <ClientErrorButton />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {'Server runtime'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {'Captures a synthetic server exception and returns its Sentry event id.'}
          </p>
          <ServerErrorButton />
        </div>
      </section>
    </main>
  );
}
