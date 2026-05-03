import { PlaceholderPage } from '@/components/placeholder-page';

export default function CreateOrganizationPage() {
  return (
    <PlaceholderPage
      title="Create organization"
      route="/onboarding/create-organization"
      priority="P0"
      sprint="2"
      backendDeps={['organizations', 'organization_memberships', 'users']}
    />
  );
}
