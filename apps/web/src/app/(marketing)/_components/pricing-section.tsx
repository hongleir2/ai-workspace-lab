import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { db, eq, plans } from '@ai-workspace-lab/db';
import { Check } from 'lucide-react';

function formatPrice(priceCents: number, interval: string): string {
  if (priceCents === 0) return 'Free';
  const dollars = (priceCents / 100).toFixed(0);
  return interval === 'month' ? `$${dollars}/mo` : `$${dollars}/yr`;
}

const FREE_FEATURES = [
  '3 document uploads',
  '50 AI messages / month',
  '10 MB max file size',
  '1 workspace',
  'Community support',
];

const PRO_FEATURES = [
  'Unlimited document uploads',
  '500 AI messages / month',
  '50 MB max file size',
  'Unlimited workspaces',
  'Priority support',
  'Usage analytics',
];

export async function PricingSection() {
  const [monthlyPlan, yearlyPlan] = await Promise.all([
    db
      .select()
      .from(plans)
      .where(eq(plans.id, 'pro_monthly'))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(plans)
      .where(eq(plans.id, 'pro_yearly'))
      .limit(1)
      .then((r) => r[0]),
  ]);

  return (
    <section id="pricing" className="bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            {'Pricing'}
          </p>
          <h2 className="font-display text-4xl font-bold text-slate-900">
            {'Simple, transparent pricing'}
          </h2>
          <p className="font-body mt-3 text-slate-600">
            {'Start free. Upgrade when your team needs more.'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          {/* Free plan */}
          <div className="rounded-xl border border-slate-200 bg-white p-8">
            <div className="mb-6">
              <h3 className="font-display mb-1 text-xl font-bold text-slate-900">{'Free'}</h3>
              <p className="font-body text-sm text-slate-500">
                {'For individuals getting started'}
              </p>
            </div>
            <div className="mb-8">
              <span className="font-display text-4xl font-bold text-slate-900">{'$0'}</span>
              <span className="font-body ml-1 text-slate-500">{'/ month'}</span>
            </div>
            <ul className="mb-8 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="font-body text-sm text-slate-600">{feature}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="w-full cursor-pointer">
              <Link href="/sign-up">{'Get started free'}</Link>
            </Button>
          </div>

          {/* Pro plan */}
          <div className="relative rounded-xl border-2 border-blue-600 bg-white p-8 shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                {'Most popular'}
              </span>
            </div>
            <div className="mb-6">
              <h3 className="font-display mb-1 text-xl font-bold text-slate-900">{'Pro'}</h3>
              <p className="font-body text-sm text-slate-500">{'For teams that move fast'}</p>
            </div>
            <div className="mb-2">
              {monthlyPlan ? (
                <>
                  <span className="font-display text-4xl font-bold text-slate-900">
                    {formatPrice(monthlyPlan.priceCents, 'month').replace('/mo', '')}
                  </span>
                  <span className="font-body ml-1 text-slate-500">{'/ month'}</span>
                </>
              ) : (
                <span className="font-display text-4xl font-bold text-slate-900">{'Pro'}</span>
              )}
            </div>
            {yearlyPlan && yearlyPlan.priceCents > 0 && (
              <p className="font-body mb-6 text-sm text-green-600">
                {`Or ${formatPrice(yearlyPlan.priceCents, 'year')} billed annually (save 20%)`}
              </p>
            )}
            {!yearlyPlan && <div className="mb-6" />}
            <ul className="mb-8 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="font-body text-sm text-slate-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700">
              <Link href="/sign-up">{'Start Pro free trial'}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
