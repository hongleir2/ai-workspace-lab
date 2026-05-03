import { PlaceholderPage } from '@/components/placeholder-page';

export default function OrgSettingsPage() {
  return (
    <PlaceholderPage
      title="Organization settings"
      route="/app/[orgSlug]/settings"
      priority="P0"
      sprint="2"
      backendDeps={['organizations', 'organization_memberships']}
    />
  );
}
