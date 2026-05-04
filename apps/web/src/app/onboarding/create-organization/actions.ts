'use server';

import { requireUser } from '@/lib/auth/user';
import { OrgSlugConflictError, OrgSlugInvalidError, createOrganization } from '@/lib/orgs/service';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function createOrganizationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const rawName = String(formData.get('name') ?? '');
  const normalizedName = rawName.trim();
  const slugRaw = String(formData.get('slug') ?? '').trim();
  if (normalizedName.length < 1 || normalizedName.length > 100) {
    redirect('/onboarding/create-organization?error=invalid_name');
  }

  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ipAddress =
    forwarded !== null && forwarded.length > 0 ? (forwarded.split(',')[0]?.trim() ?? null) : null;
  const userAgent = headerList.get('user-agent');

  let createdSlug: string;
  try {
    const { organization } = await createOrganization({
      name: normalizedName,
      ...(slugRaw.length > 0 ? { slugOverride: slugRaw } : {}),
      ownerUserId: user.id,
      ...(ipAddress !== null ? { ipAddress } : {}),
      ...(userAgent !== null ? { userAgent } : {}),
    });
    createdSlug = organization.slug;
  } catch (e: unknown) {
    if (e instanceof OrgSlugConflictError) {
      redirect('/onboarding/create-organization?error=slug_taken');
    }
    if (e instanceof OrgSlugInvalidError) {
      const errorCode = slugRaw.length > 0 ? 'invalid_slug' : 'name_too_short';
      redirect(`/onboarding/create-organization?error=${errorCode}`);
    }
    throw e;
  }
  redirect(`/app/${createdSlug}`);
}
