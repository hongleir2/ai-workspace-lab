import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { db, eq, plans } from '@ai-workspace-lab/db';
import { Check } from 'lucide-react';

function formatPrice(priceCents: number): string {
  if (priceCents === 0) return '$0';
  return `$${(priceCents / 100).toFixed(0)}`;
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

const TEAM_FEATURES = [
  'Everything in Pro',
  'Unlimited AI messages',
  'Custom file size limits',
  'SSO / SAML',
  'Dedicated support',
  'SLA & audit logs',
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
    <section id="pricing" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            {'Pricing'}
          </p>
          <h2 className="font-display text-4xl font-bold text-white">
            {'Simple, transparent pricing'}
          </h2>
          <p className="font-body mt-3 text-slate-400">
            {'Start free. Upgrade when your team needs more.'}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
          {/* Free */}
          <div className="flex flex-col rounded-xl border border-white/10 bg-[#0d1226] p-8">
            <div className="mb-6">
              <h3 className="font-display mb-1 text-xl font-bold text-white">{'Free'}</h3>
              <p className="font-body text-sm text-slate-500">
                {'For individuals getting started'}
              </p>
            </div>
            <div className="mb-8">
              <span className="font-display text-4xl font-bold text-white">{'$0'}</span>
              <span className="font-body ml-1 text-slate-500">{'/ month'}</span>
            </div>
            <ul className="mb-8 flex-1 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="font-body text-sm text-slate-400">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant="outline"
              className="w-full cursor-pointer border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/sign-up">{'Get started free'}</Link>
            </Button>
          </div>

          {/* Pro (highlighted) */}
          <div className="relative flex flex-col rounded-xl border-2 border-indigo-500/60 bg-[#0d1226] p-8 shadow-lg shadow-indigo-500/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30">
                {'Most popular'}
              </span>
            </div>
            <div className="mb-6">
              <h3 className="font-display mb-1 text-xl font-bold text-white">{'Pro'}</h3>
              <p className="font-body text-sm text-slate-500">{'For teams that move fast'}</p>
            </div>
            <div className="mb-2">
              {monthlyPlan ? (
                <>
                  <span className="font-display text-4xl font-bold text-white">
                    {formatPrice(monthlyPlan.priceCents)}
                  </span>
                  <span className="font-body ml-1 text-slate-500">{'/ month'}</span>
                </>
              ) : (
                <span className="font-display text-4xl font-bold text-white">{'Pro'}</span>
              )}
            </div>
            {yearlyPlan && yearlyPlan.priceCents > 0 && (
              <p className="font-body mb-6 text-sm text-emerald-400">
                {`Or ${formatPrice(yearlyPlan.priceCents)}/yr billed annually (save 20%)`}
              </p>
            )}
            {!yearlyPlan && <div className="mb-6" />}
            <ul className="mb-8 flex-1 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="font-body text-sm text-slate-300">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              className="w-full cursor-pointer bg-gradient-to-r from-indigo-500 to-blue-500 font-semibold text-white hover:from-indigo-600 hover:to-blue-600"
            >
              <Link href="/sign-up">{'Start Pro free trial'}</Link>
            </Button>
          </div>

          {/* Team */}
          <div className="flex flex-col rounded-xl border border-white/10 bg-[#0d1226] p-8">
            <div className="mb-6">
              <h3 className="font-display mb-1 text-xl font-bold text-white">{'Team'}</h3>
              <p className="font-body text-sm text-slate-500">{'For scaling organizations'}</p>
            </div>
            <div className="mb-8">
              <span className="font-display text-4xl font-bold text-white">{'Custom'}</span>
            </div>
            <ul className="mb-8 flex-1 space-y-3">
              {TEAM_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-violet-400" />
                  <span className="font-body text-sm text-slate-400">{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant="outline"
              className="w-full cursor-pointer border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="mailto:hello@aiworkspace.io">{'Contact sales'}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
