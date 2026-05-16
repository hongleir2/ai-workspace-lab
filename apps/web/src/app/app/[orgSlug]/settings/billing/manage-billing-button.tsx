'use client';

import { Button } from '@/components/ui/button';
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
      onClick={() => startTransition(() => openBillingPortalAction(orgSlug))}
      disabled={isPending}
    >
      {isPending ? 'Opening portal...' : 'Manage Billing'}
    </Button>
  );
}
