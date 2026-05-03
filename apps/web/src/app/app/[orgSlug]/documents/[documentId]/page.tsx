import { PlaceholderPage } from '@/components/placeholder-page';

export default function DocumentDetailPage() {
  return (
    <PlaceholderPage
      title="Document detail"
      route="/app/[orgSlug]/documents/[documentId]"
      priority="P0"
      sprint="7"
      backendDeps={['documents', 'document_chunks', 'storage_objects']}
    />
  );
}
