'use client';

import { Button } from '@/components/ui/button';
import { trackCheckoutStarted } from '@ai-workspace-lab/analytics';
import { useTransition } from 'react';
import { startCheckoutAction } from './actions';

interface UpgradeButtonProps {
  priceId: string;
  orgSlug: string;
  label: string;
}

export function UpgradeButton({ priceId, orgSlug, label }: UpgradeButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => {
        trackCheckoutStarted(orgSlug, priceId);
        startTransition(() => startCheckoutAction(priceId, orgSlug));
      }}
      disabled={isPending || priceId === ''}
    >
      {isPending ? 'Redirecting to Stripe...' : label}
    </Button>
  );
}
