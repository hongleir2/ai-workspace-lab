import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Plan = 'free' | 'pro' | 'enterprise';

interface PlanBadgeProps {
  plan?: Plan;
  daysLeft?: number;
  className?: string;
}

interface PlanCopy {
  pill: string;
  title: string;
  description: (daysLeft: number) => string;
  button: string;
  variant: 'default' | 'outline';
}

const planCopy: Record<Plan, PlanCopy> = {
  free: {
    pill: 'Free',
    title: 'Free plan',
    description: () => 'Upgrade to Pro for unlimited',
    button: 'Compare plans',
    variant: 'default',
  },
  pro: {
    pill: 'Trial',
    title: 'Pro plan',
    description: (daysLeft) => `${daysLeft} days left in trial`,
    button: 'Upgrade',
    variant: 'default',
  },
  enterprise: {
    pill: 'Enterprise',
    title: 'Enterprise plan',
    description: () => 'Custom plan',
    button: 'Contact sales',
    variant: 'outline',
  },
};

export function PlanBadge({ plan = 'pro', daysLeft = 14, className }: PlanBadgeProps) {
  const copy = planCopy[plan];
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
      <p className="text-xs text-muted-foreground">{copy.description(daysLeft)}</p>
      <Button size="sm" variant={copy.variant} className="w-full cursor-pointer">
        {copy.button}
      </Button>
    </div>
  );
}
