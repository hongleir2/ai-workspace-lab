import { PlaceholderPage } from '@/components/placeholder-page';

export default function AiSessionPage() {
  return (
    <PlaceholderPage
      title="AI session"
      route="/app/[orgSlug]/ai/sessions/[sessionId]"
      priority="P0"
      sprint="8–9"
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
