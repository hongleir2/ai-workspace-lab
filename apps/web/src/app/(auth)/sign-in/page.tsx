import { Alert, AlertDescription } from '@/components/ui/alert';
import { getCurrentUser } from '@/lib/auth/user';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignInForm } from './sign-in-form';

export const dynamic = 'force-dynamic';

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getCurrentUser();
  if (user) redirect('/app');

  const params = await searchParams;
  const error = typeof params['error'] === 'string' ? params['error'] : undefined;
  const message = typeof params['message'] === 'string' ? params['message'] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your account to continue.</p>
      </div>

      {error === 'account_disabled' ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your account has been disabled. Please contact support.
          </AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{decodeURIComponent(error)}</AlertDescription>
        </Alert>
      ) : null}

      {message === 'check_email' && (
        <Alert>
          <AlertDescription>
            Check your inbox — click the confirmation link to activate your account, then sign in.
          </AlertDescription>
        </Alert>
      )}

      <SignInForm />

      <p className="text-center text-sm text-muted-foreground">
        {"Don't have an account? "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
