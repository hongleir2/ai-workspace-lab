import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requireUser } from '@/lib/auth/user';
import { createOrganizationAction } from './actions';
import { SubmitButton } from './submit-button';

export const dynamic = 'force-dynamic';

interface CreateOrganizationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveError(code: string | undefined): string | null {
  if (code === undefined) return null;

  switch (code) {
    case 'invalid_name':
      return 'Enter an organization name between 1 and 100 characters.';
    case 'slug_taken':
      return 'That URL slug is already taken. Customize the slug below or tweak the workspace name.';
    case 'invalid_slug':
      return 'Slug must be 3–40 characters, lowercase letters, numbers, and hyphens — no leading or trailing hyphen.';
    case 'name_too_short':
      return 'Organization name is too short or too long to generate a URL slug — try a different name or set a custom slug below.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default async function CreateOrganizationPage({
  searchParams,
}: CreateOrganizationPageProps) {
  await requireUser();

  const params = await searchParams;
  const errorParam =
    typeof params['error'] === 'string'
      ? params['error']
      : Array.isArray(params['error'])
        ? params['error'][0]
        : undefined;
  const alertMessage = resolveError(errorParam);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10 md:py-14">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {'Create your workspace'}
        </h1>
        <p className="text-sm text-muted-foreground">{'Tell us what to call your team space.'}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{'Organization'}</CardTitle>
          <CardDescription>{'Choose a workspace name — you can rename it later.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {alertMessage !== null ? (
            <Alert variant="destructive">
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form action={createOrganizationAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="name">
                Workspace name
              </label>
              <Input
                autoFocus
                autoComplete="organization"
                id="name"
                name="name"
                placeholder="Acme Labs"
                required
              />
            </div>

            <details className="rounded-md border px-4 py-2 text-sm">
              <summary className="cursor-pointer font-medium outline-none">
                Customize URL slug
              </summary>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm text-muted-foreground" htmlFor="slug">
                  Slug appears as <strong className="text-foreground">/app/your-slug</strong> —
                  lowercase, optional.
                </label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="leave blank to derive from name"
                  type="text"
                />
              </div>
            </details>

            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
