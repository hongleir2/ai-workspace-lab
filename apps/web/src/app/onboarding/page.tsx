import { PlaceholderPage } from '@/components/placeholder-page';

export default function OnboardingPage() {
  return (
    <PlaceholderPage
      title="Onboarding router"
      route="/onboarding"
      priority="P0"
      sprint="2"
      backendDeps={['organizations', 'organization_memberships']}
    />
  );
}
