import { PlaceholderPage } from '@/components/placeholder-page';

export default function BillingPage() {
  return (
    <PlaceholderPage
      title="Billing overview"
      route="/app/[orgSlug]/billing"
      priority="P0"
      sprint="4"
      backendDeps={[
        'plans',
        'plan_limits',
        'billing_customers',
        'subscriptions',
        'stripe_events',
        'usage_counters',
      ]}
    />
  );
}
