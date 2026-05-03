import { PlaceholderPage } from '@/components/placeholder-page';

export default function AccountProfilePage() {
  return (
    <PlaceholderPage
      title="Profile"
      route="/account/profile"
      priority="P1"
      sprint="1–2"
      backendDeps={['users']}
    />
  );
}
