# 0010 — File Storage and Document Ownership

## Status
Accepted

## Context

Documents uploaded by users must belong exclusively to the organization that uploaded them. The two-phase upload flow (server-issued presigned URL → client PUT to R2) creates a window between presigned URL creation and actual file delivery during which the document row and storage object row already exist in the database.

Key constraints:
- A document row must always carry the `organization_id` of the uploading org.
- A user in org A must never be able to read or overwrite a document belonging to org B.
- File type and size limits are enforced by the storage service before any database row is created.
- Quota checks (entitlements) run before storage operations.

## Decision

**Ownership assignment**: `organization_id` is set server-side at document creation time, taken from the authenticated session's resolved organization (via `requireMembership` / `getOrganizationBySlug`). The client never supplies an `organization_id`.

**Read isolation**: Every document query filters by both `document.id` AND `document.organization_id`. This is enforced at the application layer; RLS provides the safety net for direct DB access.

**Upload authorization**: The storage service's `createUploadTarget` calls `assertCanUploadToOrg` which verifies the user is an active member of the target organization before issuing a presigned URL. If this check fails, a `StorageError(NOT_AUTHORIZED)` is thrown and mapped to HTTP 402.

**Validation order** (enforced in `createDocumentUploadTarget`):
1. `assertFeatureAllowed` — plan includes `document_uploads` and quota not exceeded
2. `getMaxFileSizeMb` — load the plan's file size limit
3. `createUploadTarget` — validate file type + size, generate presigned URL, run org auth check
4. `createStorageObjectRow` — insert storage object row
5. `db.insert(documents)` — insert document row with `organization_id`
6. `recordUsageWithCounter` — increment quota counter with document id as idempotency key

**Known limitation**: Steps 4–6 are not wrapped in a transaction. If step 6 (`recordUsageWithCounter`) fails after the document row is inserted, a quota hole exists (document is stored but not counted against the quota). Accepted as an MVP trade-off; the document id as idempotency key allows correct retroactive counting if usage is replayed.

**Soft-delete**: Documents are never hard-deleted. Queries for active documents always include `isNull(documents.deletedAt)`. Storage objects are similarly soft-deleted; the document detail query joins on `storageObjects` and guards with `isNull(storageObjects.deletedAt)`.

## Consequences

- All document reads require an `organization_id` predicate — missing this predicate is a data isolation bug.
- The client cannot choose which organization to upload to; the server resolves org from the URL slug.
- File type and size rejections surface as `StorageError` codes and are mapped to HTTP 400 at the route boundary.
- Quota exhaustion surfaces as `EntitlementError(QUOTA_EXCEEDED)` and is mapped to HTTP 429.
- Cross-org upload attempts surface as `StorageError(NOT_AUTHORIZED)` and are mapped to HTTP 402.
- Future work: wrap steps 4–6 in a database transaction to close the quota-hole window.
