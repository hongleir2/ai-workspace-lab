import Link from 'next/link';

import { Button } from '@/components/ui/button';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.18),transparent)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Text column */}
          <div>
            <div className="mb-5 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-400">
              {'AI-powered document workspace'}
            </div>

            <h1 className="font-display mb-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl">
              {"Your team's AI workspace for "}
              <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                {'knowledge.'}
              </span>
            </h1>

            <p className="font-body mb-8 max-w-lg text-lg leading-relaxed text-slate-400">
              {
                'Upload documents, ask questions in plain language, and get AI-powered answers with cited sources — all inside a secure team workspace.'
              }
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="cursor-pointer bg-gradient-to-r from-indigo-500 to-blue-500 px-8 font-semibold text-white hover:from-indigo-600 hover:to-blue-600"
              >
                <Link href="/sign-up">{'Get started free'}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="cursor-pointer border-white/20 bg-white/5 px-8 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="#how-it-works">{'See how it works'}</Link>
              </Button>
            </div>

            <p className="font-body mt-6 text-sm text-slate-500">
              {'No credit card required · Free tier available · Cancel anytime'}
            </p>
          </div>

          {/* Product mockup column */}
          <div className="relative lg:pl-4">
            <div className="absolute -inset-4 rounded-2xl bg-indigo-500/5 blur-2xl" />
            <div className="relative rounded-xl border border-white/10 bg-[#0d1226] shadow-2xl shadow-black/50">
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                <span className="ml-3 text-xs text-slate-500">{'AI Workspace — Documents'}</span>
              </div>

              <div className="flex" style={{ minHeight: '300px' }}>
                {/* Sidebar */}
                <div className="w-44 shrink-0 border-r border-white/10 p-3">
                  <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    {'Documents'}
                  </p>
                  {['Q3 Roadmap.pdf', 'Product Spec.pdf', 'Team Handbook.pdf', 'API Docs.pdf'].map(
                    (name) => (
                      <div
                        key={name}
                        className="mb-0.5 flex items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-white/5"
                      >
                        <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-indigo-500/50" />
                        <span className="truncate">{name}</span>
                      </div>
                    ),
                  )}
                </div>

                {/* Chat */}
                <div className="flex-1 p-4">
                  <div className="mb-3 flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                      {'U'}
                    </div>
                    <div className="rounded-lg bg-white/5 px-3 py-2 text-xs leading-relaxed text-slate-300">
                      {'What does Q3 roadmap say about the API timeline?'}
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {'AI'}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="rounded-lg bg-indigo-500/10 px-3 py-2 text-xs leading-relaxed text-slate-300">
                        {
                          'According to Q3 Roadmap, the API integration is scheduled for completion by end of August, with a public beta in September...'
                        }
                      </div>
                      <div className="flex items-center gap-1.5 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        <span className="text-xs text-indigo-400">
                          {'Source: Q3 Roadmap.pdf, page 4'}
                        </span>
                      </div>
                    </div>
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
