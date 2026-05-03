import { PlaceholderPage } from '@/components/placeholder-page';

export default function AdminOverviewPage() {
  return (
    <PlaceholderPage
      title="Admin overview"
      route="/admin"
      priority="P1"
      sprint="11"
      backendDeps={['users', 'organizations', 'jobs', 'stripe_events']}
    />
  );
}
