import { PlaceholderPage } from '@/components/placeholder-page';

export default function PricingPage() {
  return (
    <PlaceholderPage
      title="Pricing"
      route="/pricing"
      priority="P0"
      sprint="4"
      backendDeps={['plans', 'plan_limits']}
    />
  );
}
