import {
  type AuditLog,
  type Database,
  type NewAuditLog,
  type Organization,
  type OrganizationMembership,
  and,
  auditLogs,
  db,
  eq,
  isNull,
  organizationMemberships,
  organizations,
  sql,
} from '@ai-workspace-lab/db';
import { OrgSlugConflictError, generateUniqueSlug } from './slug';

export { OrgSlugConflictError, OrgSlugInvalidError } from './slug';

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505';
}

export interface CreateOrganizationParams {
  name: string;
  slugOverride?: string;
  ownerUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function getOrganizationBySlug(
  slug: string,
  dbConn: Database = db,
): Promise<Organization | null> {
  const rows = await dbConn
    .select()
    .from(organizations)
    .where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserOrganizations(
  userId: string,
  dbConn: Database = db,
): Promise<Array<{ organization: Organization; membership: OrganizationMembership }>> {
  const rows = await dbConn
    .select({
      organization: organizations,
      membership: organizationMemberships,
    })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, 'active'),
        eq(organizations.status, 'active'),
        isNull(organizations.deletedAt),
      ),
    )
    .orderBy(sql`${organizationMemberships.joinedAt} DESC NULLS LAST`);

  return rows.map((r) => ({
    organization: r.organization,
    membership: r.membership,
  }));
}

export async function createAuditLog(
  payload: Omit<NewAuditLog, 'id' | 'createdAt'>,
  dbConn: Database = db,
): Promise<AuditLog> {
  const [row] = await dbConn.insert(auditLogs).values(payload).returning();
  if (!row) {
    throw new Error('Failed to create audit log');
  }
  return row;
}

export async function createOrganization(
  params: CreateOrganizationParams,
  dbConn: Database = db,
): Promise<{ organization: Organization; membership: OrganizationMembership }> {
  const trimmedName = params.name.trim();
  if (trimmedName.length < 1 || trimmedName.length > 100) {
    throw new Error('Invalid organization name');
  }

  const slug = await generateUniqueSlug(
    trimmedName,
    async (s) => (await getOrganizationBySlug(s, dbConn)) !== null,
    params.slugOverride,
  );

  return dbConn.transaction(async (tx) => {
    let organization: Organization;
    try {
      const [row] = await tx
        .insert(organizations)
        .values({
          name: trimmedName,
          slug,
          ownerUserId: params.ownerUserId,
          status: 'active',
        })
        .returning();
      if (!row) throw new Error('Failed to insert organization');
      organization = row;
    } catch (e) {
      if (isUniqueViolation(e)) throw new OrgSlugConflictError();
      throw e;
    }

    const [membership] = await tx
      .insert(organizationMemberships)
      .values({
        organizationId: organization.id,
        userId: params.ownerUserId,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      })
      .returning();
    if (!membership) {
      throw new Error('Failed to insert organization membership');
    }

    await tx.insert(auditLogs).values({
      organizationId: organization.id,
      actorUserId: params.ownerUserId,
      action: 'organization.created',
      entityType: 'organization',
      entityId: organization.id,
      afterState: { name: trimmedName, slug },
      ipAddress: params.ipAddress ?? undefined,
      userAgent: params.userAgent ?? undefined,
    });

    return { organization, membership };
  });
}
