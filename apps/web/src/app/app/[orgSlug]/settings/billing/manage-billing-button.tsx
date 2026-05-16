'use client';

import { Button } from '@/components/ui/button';
import { trackBillingPortalOpened } from '@ai-workspace-lab/analytics';
import { useTransition } from 'react';
import { openBillingPortalAction } from './actions';

interface ManageBillingButtonProps {
  orgSlug: string;
}

export function ManageBillingButton({ orgSlug }: ManageBillingButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      onClick={() => {
        trackBillingPortalOpened(orgSlug);
        startTransition(() => openBillingPortalAction(orgSlug));
      }}
      disabled={isPending}
    >
      {isPending ? 'Opening portal...' : 'Manage Billing'}
    </Button>
  );
}
