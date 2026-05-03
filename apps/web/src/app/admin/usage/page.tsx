import { PlaceholderPage } from '@/components/placeholder-page';

export default function AdminUsagePage() {
  return (
    <PlaceholderPage
      title="Usage admin"
      route="/admin/usage"
      priority="P1"
      sprint="11"
      backendDeps={['usage_events', 'usage_counters', 'organizations']}
    />
  );
}
