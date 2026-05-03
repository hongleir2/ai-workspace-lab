import { PlaceholderPage } from '@/components/placeholder-page';

export default function AppRouterPage() {
  return (
    <PlaceholderPage
      title="App router"
      route="/app"
      priority="P0"
      sprint="2"
      backendDeps={['organizations', 'organization_memberships']}
    />
  );
}
