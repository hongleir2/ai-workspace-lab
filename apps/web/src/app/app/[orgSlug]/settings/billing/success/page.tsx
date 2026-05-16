import { Button } from '@/components/ui/button';
import { requireMembership } from '@/lib/orgs/guards';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function BillingSuccessPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireMembership(orgSlug);

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <CheckCircle className="h-12 w-12 text-green-500" />
      <div>
        <h1 className="text-2xl font-semibold">{'Payment received'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {'Your plan will activate shortly. It may take a moment to update.'}
        </p>
      </div>
      <Button asChild>
        <Link href={`/app/${orgSlug}/settings/billing`}>{'Go to Billing'}</Link>
      </Button>
    </div>
  );
}
