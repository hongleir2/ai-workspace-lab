import { PlaceholderPage } from '@/components/placeholder-page';

export default function OrgDashboardPage() {
  return (
    <PlaceholderPage
      title="Organization dashboard"
      route="/app/[orgSlug]"
      priority="P0"
      sprint="2"
      backendDeps={[
        'organizations',
        'organization_memberships',
        'documents',
        'ai_sessions',
        'usage_counters',
        'subscriptions',
        'audit_logs',
      ]}
    />
  );
}
