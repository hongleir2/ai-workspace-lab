import { PlaceholderPage } from '@/components/placeholder-page';

export default function AskDocumentPage() {
  return (
    <PlaceholderPage
      title="Ask about document"
      route="/app/[orgSlug]/documents/[documentId]/ask"
      priority="P0"
      sprint="9"
      backendDeps={[
        'ai_sessions',
        'ai_messages',
        'ai_message_sources',
        'document_chunks',
        'usage_events',
        'usage_counters',
      ]}
    />
  );
}
