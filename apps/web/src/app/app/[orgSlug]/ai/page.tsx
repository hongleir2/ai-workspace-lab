import { PlaceholderPage } from '@/components/placeholder-page';

export default function AiHomePage() {
  return (
    <PlaceholderPage
      title="AI chat home"
      route="/app/[orgSlug]/ai"
      priority="P0"
      sprint="8"
      backendDeps={['ai_sessions', 'ai_messages', 'usage_counters']}
    />
  );
}
