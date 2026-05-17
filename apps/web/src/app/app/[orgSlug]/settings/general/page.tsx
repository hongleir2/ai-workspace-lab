import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type MemberRole, requireMembership } from '@/lib/orgs/guards';
import { ThemeSelector } from './_components/theme-selector';

export const dynamic = 'force-dynamic';

interface GeneralSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

const roleInfo: Record<MemberRole, { label: string; description: string }> = {
  owner: { label: 'Owner', description: 'Full access to all settings and billing.' },
  admin: { label: 'Admin', description: 'Can manage members and most settings.' },
  member: { label: 'Member', description: 'Can use the workspace and view settings.' },
};

export default async function GeneralSettingsPage({ params }: GeneralSettingsPageProps) {
  const { orgSlug } = await params;
  // SettingsLayout already validated membership via OrgLayout; re-call here for org + role data.
  const { organization, membership } = await requireMembership(orgSlug);

  const role = roleInfo[membership.role] ?? { label: membership.role, description: '' };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{'Organization'}</CardTitle>
          <CardDescription>{'Basic information about your workspace.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y">
            <div className="grid grid-cols-3 gap-4 py-3 first:pt-0">
              <dt className="self-center text-sm text-muted-foreground">{'Name'}</dt>
              <dd className="col-span-2 text-sm font-medium">{organization.name}</dd>
            </div>
            <div className="grid grid-cols-3 gap-4 py-3">
              <dt className="self-center text-sm text-muted-foreground">{'URL slug'}</dt>
              <dd className="col-span-2 font-mono text-sm text-muted-foreground">
                {organization.slug}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4 py-3 last:pb-0">
              <dt className="self-center text-sm text-muted-foreground">{'Created'}</dt>
              <dd className="col-span-2 text-sm text-muted-foreground">
                {organization.createdAt.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{'Your Access'}</CardTitle>
          <CardDescription>{'Your role in this organization.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <div className="grid grid-cols-3 gap-4">
              <dt className="self-center text-sm text-muted-foreground">{'Role'}</dt>
              <dd className="col-span-2 flex flex-col gap-1">
                <Badge variant="secondary" className="w-fit capitalize">
                  {role.label}
                </Badge>
                <p className="text-xs text-muted-foreground">{role.description}</p>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{'Appearance'}</CardTitle>
          <CardDescription>{'Choose your preferred color theme.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </div>
  );
}
