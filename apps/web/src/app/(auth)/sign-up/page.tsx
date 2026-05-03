import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCurrentUser } from '@/lib/auth/user';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUpAction } from './actions';

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

      <form action={signUpAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>

        <Button type="submit" className="w-full">
          Create account
        </Button>
      </form>

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
