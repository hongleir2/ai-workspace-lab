import { PlaceholderPage } from '@/components/placeholder-page';

export default function UsagePage() {
  return (
    <PlaceholderPage
      title="Usage overview"
      route="/app/[orgSlug]/usage"
      priority="P0"
      sprint="3"
      backendDeps={['usage_events', 'usage_counters', 'plan_limits', 'subscriptions', 'plans']}
    />
  );
}
