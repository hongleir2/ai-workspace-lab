import { PlaceholderPage } from '@/components/placeholder-page';

export default function SignInPage() {
  return (
    <PlaceholderPage
      title="Sign in"
      route="/sign-in"
      priority="P0"
      sprint="1"
      backendDeps={['users', 'supabase_auth']}
    />
  );
}
