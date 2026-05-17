import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display mb-4 text-4xl font-bold text-slate-900 md:text-5xl">
          {'Ready to unlock your team’s knowledge?'}
        </h2>
        <p className="font-body mb-10 text-lg text-slate-600">
          {
            'Join teams already using AI Workspace to find answers faster. Free to start, no credit card required.'
          }
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="cursor-pointer bg-blue-600 px-10 hover:bg-blue-700">
            <Link href="/sign-up">{'Get started free'}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="cursor-pointer px-10">
            <Link href="#pricing">{'View pricing'}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
