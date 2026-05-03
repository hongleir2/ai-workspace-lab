import { PlaceholderPage } from '@/components/placeholder-page';

export default function AccountPage() {
  return (
    <PlaceholderPage
      title="Account overview"
      route="/account"
      priority="P1"
      sprint="1–2"
      backendDeps={['users', 'organization_memberships', 'organizations']}
    />
  );
}
