import { Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlanBadgeProps {
  orgSlug: string;
  planId: string;
  planName: string;
  subscriptionStatus: string;
  daysLeft?: number;
  className?: string;
}

type BadgeVariant = 'default' | 'outline';
interface BadgeCopy {
  pill: string;
  title: string;
  description: string;
  button: string | null;
  variant: BadgeVariant;
}

function deriveBadge(
  planId: string,
  planName: string,
  subscriptionStatus: string,
  daysLeft: number | undefined,
): BadgeCopy {
  if (planId === 'free' || subscriptionStatus === 'free') {
    return {
      pill: 'Free',
      title: planName,
      description: 'Upgrade to Pro for unlimited',
      button: 'Compare plans',
      variant: 'default',
    };
  }
  if (subscriptionStatus === 'trialing') {
    return {
      pill: 'Trial',
      title: planName,
      description: daysLeft !== undefined ? `${daysLeft} days left in trial` : 'Trial active',
      button: 'Upgrade',
      variant: 'default',
    };
  }
  if (planId.startsWith('pro')) {
    return {
      pill: 'Pro',
      title: planName,
      description: 'Active subscription',
      button: null,
      variant: 'outline',
    };
  }
  return {
    pill: 'Business',
    title: planName,
    description: 'Custom plan',
    button: 'Contact sales',
    variant: 'outline',
  };
}

export function PlanBadge({
  orgSlug,
  planId,
  planName,
  subscriptionStatus,
  daysLeft,
  className,
}: PlanBadgeProps) {
  const copy = deriveBadge(planId, planName, subscriptionStatus, daysLeft);
  return (
    <div
      className={cn('rounded-md border border-border bg-card p-3 flex flex-col gap-2', className)}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">{copy.title}</span>
        <span className="ml-auto rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold">
          {copy.pill}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{copy.description}</p>
      {copy.button !== null && (
        <Button size="sm" variant={copy.variant} className="w-full cursor-pointer" asChild>
          <Link href={`/app/${orgSlug}/settings/billing`}>{copy.button}</Link>
        </Button>
      )}
    </div>
  );
}
