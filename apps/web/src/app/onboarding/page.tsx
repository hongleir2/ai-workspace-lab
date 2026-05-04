import { requireUser } from '@/lib/auth/user';
import { getUserOrganizations } from '@/lib/orgs/service';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const user = await requireUser();
  const orgs = await getUserOrganizations(user.id);

  if (orgs.length === 0) redirect('/onboarding/create-organization');
  redirect('/app');
}
