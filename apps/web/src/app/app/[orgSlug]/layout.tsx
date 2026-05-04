import { AppSidebar } from '@/components/nav/app-sidebar';
import { AppTopbar } from '@/components/nav/app-topbar';
import { requireMembership } from '@/lib/orgs/guards';
import { getUserOrganizations } from '@/lib/orgs/service';
import type { ReactNode } from 'react';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const { user, organization } = await requireMembership(orgSlug);
  const memberships = await getUserOrganizations(user.id);
  const allOrgs = memberships.map(({ organization: org }) => ({
    slug: org.slug,
    name: org.name,
  }));

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar orgSlug={orgSlug} orgName={organization.name} allOrgs={allOrgs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar orgSlug={orgSlug} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
