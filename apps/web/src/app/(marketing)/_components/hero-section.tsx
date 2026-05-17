import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-6 pb-24 pt-20">
      {/* Subtle grid overlay */}
      <div className="bg-grid-pattern bg-grid-fade absolute inset-0 opacity-30" />

      <div className="relative mx-auto max-w-5xl text-center">
        {/* Eyebrow badge */}
        <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-700">
          {'AI-powered document workspace'}
        </div>

        {/* H1 */}
        <h1 className="font-display mb-6 text-5xl font-bold leading-tight tracking-tight text-slate-900 md:text-6xl">
          {"Your team's knowledge,"}
          <br />
          <span className="text-blue-600">{'instantly searchable'}</span>
        </h1>

        {/* Subheading */}
        <p className="font-body mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-600">
          {
            'Upload documents, ask questions in plain language, and get AI-powered answers with cited sources — all inside a secure team workspace.'
          }
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="cursor-pointer bg-blue-600 px-8 hover:bg-blue-700">
            <Link href="/sign-up">{'Get started free'}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="cursor-pointer px-8">
            <Link href="#how-it-works">{'See how it works'}</Link>
          </Button>
        </div>

        {/* Social proof micro-line */}
        <p className="font-body mt-8 text-sm text-slate-400">
          {'No credit card required · Free tier available · Cancel anytime'}
        </p>

        {/* Product mockup */}
        <div className="gradient-border mx-auto mt-16 max-w-3xl">
          <div className="rounded-[calc(var(--radius)-1px)] bg-white">
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <span className="ml-2 text-xs text-slate-400">{'AI Workspace'}</span>
            </div>
            <div className="p-6 text-left">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500">
                  {'Q'}
                </div>
                <div className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                  {'What does our Q3 roadmap say about the API integration timeline?'}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                  {'AI'}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-slate-700">
                    {
                      'According to the Q3 Roadmap document, the API integration is scheduled for completion by end of August, with a public beta planned for September…'
                    }
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span className="text-xs text-blue-600">
                      {'Source: Q3 Roadmap.pdf, page 4'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
