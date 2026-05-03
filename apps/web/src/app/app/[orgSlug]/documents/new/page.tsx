import { PlaceholderPage } from '@/components/placeholder-page';

export default function UploadDocumentPage() {
  return (
    <PlaceholderPage
      title="Upload document"
      route="/app/[orgSlug]/documents/new"
      priority="P0"
      sprint="6"
      backendDeps={['documents', 'storage_objects', 'usage_events', 'entitlements', 'jobs']}
    />
  );
}
