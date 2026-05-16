import { Button } from '@/components/ui/button';
import { requireMembership } from '@/lib/orgs/guards';
import { XCircle } from 'lucide-react';
import Link from 'next/link';
import { BillingEventTracker } from '../billing-event-tracker';

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function BillingCanceledPage({ params }: Props) {
  const { orgSlug } = await params;
  await requireMembership(orgSlug);

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <BillingEventTracker event="checkout_canceled" orgSlug={orgSlug} />
      <XCircle className="h-12 w-12 text-muted-foreground" />
      <div>
        <h1 className="text-2xl font-semibold">{'Checkout Canceled'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {'No charges were made. Your current plan is unchanged.'}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={`/app/${orgSlug}/settings/billing`}>{'Back to Billing'}</Link>
      </Button>
    </div>
  );
}
