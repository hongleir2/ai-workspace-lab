import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_100%,rgba(99,102,241,0.15),transparent)]" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="font-body mb-4 text-sm font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
          {'Get started'}
        </p>
        <h2 className="font-display mb-4 text-4xl font-bold text-foreground md:text-5xl">
          {'Build your AI Workspace'}
        </h2>
        <p className="font-body mb-10 text-lg text-muted-foreground">
          {
            'Join teams already using AI Workspace to find answers faster. Free to start, no credit card required.'
          }
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="cursor-pointer bg-gradient-to-r from-indigo-500 to-blue-500 px-10 font-semibold text-white hover:from-indigo-600 hover:to-blue-600"
          >
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
