import { PlaceholderPage } from '@/components/placeholder-page';

export default function SignUpPage() {
  return (
    <PlaceholderPage
      title="Sign up"
      route="/sign-up"
      priority="P0"
      sprint="1"
      backendDeps={['users', 'supabase_auth']}
    />
  );
}
