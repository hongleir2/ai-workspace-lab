import { PlaceholderPage } from '@/components/placeholder-page';

export default function AdminStripeWebhooksPage() {
  return (
    <PlaceholderPage
      title="Stripe webhooks"
      route="/admin/webhooks/stripe"
      priority="P1"
      sprint="11"
      backendDeps={['stripe_events', 'subscriptions']}
    />
  );
}
