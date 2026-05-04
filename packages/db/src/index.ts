export { db } from './client.js';
export type { Database } from './client.js';
export * as schema from './schema/index.js';
export type { User, NewUser } from './schema/users.js';
export type { AuditLog, NewAuditLog } from './schema/audit_logs.js';
export type {
  Organization,
  NewOrganization,
  OrganizationMembership,
  NewOrganizationMembership,
} from './schema/index.js';
export {
  auditLogs,
  organizations,
  organizationMemberships,
  users,
} from './schema/index.js';
export { sql, eq, and, or, not, inArray, desc, asc, isNull } from 'drizzle-orm';
