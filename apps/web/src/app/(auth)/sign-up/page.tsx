import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCurrentUser } from '@/lib/auth/user';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignUpForm } from './sign-up-form';

export const dynamic = 'force-dynamic';

interface SignUpPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const user = await getCurrentUser();
  if (user) redirect('/app');

  const params = await searchParams;
  const error = typeof params['error'] === 'string' ? params['error'] : undefined;
  const message = typeof params['message'] === 'string' ? params['message'] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and choose a password to get started.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{decodeURIComponent(error)}</AlertDescription>
        </Alert>
      )}

      {message === 'check_email' && (
        <Alert>
          <AlertDescription>
            Check your inbox — we sent a confirmation link to verify your email address.
          </AlertDescription>
        </Alert>
      )}

      <SignUpForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
