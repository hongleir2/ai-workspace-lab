import { AlertCircle, Clock, Search } from 'lucide-react';

const problems = [
  {
    icon: Search,
    title: 'Buried in documents',
    description:
      'Critical knowledge hides in PDFs, reports, and specs that nobody can find when needed.',
  },
  {
    icon: Clock,
    title: 'Hours lost to search',
    description:
      'Team members spend hours hunting through files instead of doing the work that matters.',
  },
  {
    icon: AlertCircle,
    title: 'Answers without context',
    description:
      'Generic AI tools give confident answers with no source trail — so you never know what to trust.',
  },
];

export function ProblemStrip() {
  return (
    <section className="bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="font-body mb-10 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          {'Sound familiar?'}
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {problems.map((problem) => {
            const Icon = problem.icon;
            return (
              <div key={problem.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-200/70">
                  <Icon className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-display mb-1 font-semibold text-slate-900">
                    {problem.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed text-slate-600">
                    {problem.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
