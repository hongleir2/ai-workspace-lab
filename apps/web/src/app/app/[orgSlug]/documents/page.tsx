import { PlaceholderPage } from '@/components/placeholder-page';

export default function DocumentsPage() {
  return (
    <PlaceholderPage
      title="Document list"
      route="/app/[orgSlug]/documents"
      priority="P0"
      sprint="6"
      backendDeps={['documents', 'storage_objects', 'organization_memberships']}
    />
  );
}
