import { getServerFeatureFlag } from '@/lib/analytics/flags';
import { getCurrentUser } from '@/lib/auth/user';
import { createDocumentUploadTarget } from '@/lib/documents/service';
import { env } from '@/lib/env';
import { getOrganizationBySlug } from '@/lib/orgs/service';
import { and, db, eq, organizationMemberships } from '@ai-workspace-lab/db';
import { EntitlementError } from '@ai-workspace-lab/entitlements';
import { StorageError } from '@ai-workspace-lab/storage';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface RequestBody {
  filename: string;
  contentType: string;
  byteSize: number;
}

function isValidBody(body: unknown): body is RequestBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>)['filename'] === 'string' &&
    typeof (body as Record<string, unknown>)['contentType'] === 'string' &&
    typeof (body as Record<string, unknown>)['byteSize'] === 'number' &&
    ((body as Record<string, unknown>)['byteSize'] as number) > 0
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgSlug: string }> },
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Missing required fields: filename, contentType, byteSize' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orgSlug } = await params;
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.status !== 'active') {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const [membership] = await db
    .select({ id: organizationMemberships.id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, user.id),
        eq(organizationMemberships.organizationId, org.id),
        eq(organizationMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (env.NEXT_PUBLIC_POSTHOG_KEY) {
    const flagEnabled = await getServerFeatureFlag('document_upload_enabled', user.id);
    if (!flagEnabled) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 });
    }
  }

  try {
    const result = await createDocumentUploadTarget({
      organizationId: org.id,
      userId: user.id,
      filename: body.filename,
      contentType: body.contentType,
      byteSize: body.byteSize,
    });
    return NextResponse.json({ document: result.document, uploadUrl: result.uploadUrl });
  } catch (error: unknown) {
    if (error instanceof EntitlementError) {
      if (error.code === 'QUOTA_EXCEEDED') {
        return NextResponse.json(
          { error: 'Upload quota exceeded for this period' },
          { status: 429 },
        );
      }
      if (error.code === 'NO_ACTIVE_SUBSCRIPTION') {
        return NextResponse.json(
          { error: 'No active subscription — please set up billing' },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { error: 'Plan does not include document uploads' },
        { status: 402 },
      );
    }
    if (error instanceof StorageError) {
      if (error.code === 'INVALID_FILE_TYPE' || error.code === 'FILE_TOO_LARGE') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === 'NOT_AUTHORIZED') {
        return NextResponse.json({ error: 'Upload not authorized' }, { status: 402 });
      }
    }
    throw error;
  }
}
