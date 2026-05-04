import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member']);
export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'invited',
  'suspended',
  'removed',
]);

export const organizationMemberships = pgTable(
  'organization_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: memberRoleEnum('role').notNull(),
    status: membershipStatusEnum('status').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex('org_memberships_org_user_unique').on(t.organizationId, t.userId),
    index('org_memberships_user_org_idx').on(t.userId, t.organizationId),
    index('org_memberships_org_role_idx').on(t.organizationId, t.role),
    index('org_memberships_org_status_idx').on(t.organizationId, t.status),
  ],
);

export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert;
