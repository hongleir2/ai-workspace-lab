import { requireUser } from '@/lib/auth/user';
import type { Organization, OrganizationMembership, User } from '@ai-workspace-lab/db';
import { and, db, eq, organizationMemberships } from '@ai-workspace-lab/db';
import { redirect } from 'next/navigation';
import { getOrganizationBySlug } from './service.js';

export type MemberRole = OrganizationMembership['role'];

export async function requireOrganizationBySlug(slug: string): Promise<Organization> {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) {
    redirect('/app');
  }
  return organization;
}

export async function requireMembership(orgSlug: string): Promise<{
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
}> {
  const user = await requireUser();
  const organization = await getOrganizationBySlug(orgSlug);
  if (!organization) {
    redirect('/app');
  }

  const rows = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organization.id),
        eq(organizationMemberships.userId, user.id),
        eq(organizationMemberships.status, 'active'),
      ),
    )
    .limit(1);

  const membership = rows[0];
  if (!membership) {
    redirect('/app');
  }

  return { user, organization, membership };
}

export async function requireRole(
  orgSlug: string,
  allowedRoles: readonly MemberRole[],
): Promise<{
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
}> {
  const ctx = await requireMembership(orgSlug);
  if (!(allowedRoles as readonly string[]).includes(ctx.membership.role)) {
    redirect(`/app/${orgSlug}?error=insufficient_role`);
  }
  return ctx;
}
