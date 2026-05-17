import { BarChart2, BrainCircuit, Clock, FileUp, ShieldCheck, Users } from 'lucide-react';

const features = [
  {
    icon: FileUp,
    title: 'Instant document upload',
    description:
      'Upload PDFs and text files — processed automatically into a searchable index within seconds.',
    accent: 'from-indigo-500/20 to-indigo-500/5',
    iconColor: 'text-indigo-400',
  },
  {
    icon: BrainCircuit,
    title: 'AI-powered Q&A',
    description:
      'Ask questions in plain English and get precise answers pulled directly from your documents.',
    accent: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400',
  },
  {
    icon: Users,
    title: 'Team workspaces',
    description:
      'Organize documents by organization. Every member can search and ask across the shared library.',
    accent: 'from-violet-500/20 to-violet-500/5',
    iconColor: 'text-violet-400',
  },
  {
    icon: BarChart2,
    title: 'Usage visibility',
    description:
      'Track document count, AI queries, and storage usage. See exactly where your team stands.',
    accent: 'from-cyan-500/20 to-cyan-500/5',
    iconColor: 'text-cyan-400',
  },
  {
    icon: Clock,
    title: 'Async processing',
    description:
      'Large documents are processed in the background — no waiting, no timeouts for your team.',
    accent: 'from-emerald-500/20 to-emerald-500/5',
    iconColor: 'text-emerald-400',
  },
  {
    icon: ShieldCheck,
    title: 'Plan-based access',
    description:
      'Start free and upgrade when you need more. Entitlements are enforced server-side, always.',
    accent: 'from-rose-500/20 to-rose-500/5',
    iconColor: 'text-rose-400',
  },
];

export function FeaturesSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            {'Features'}
          </p>
          <h2 className="font-display text-4xl font-bold text-white">
            {'Everything you need for intelligent document use'}
          </h2>
          <p className="font-body mt-3 text-slate-400">
            {'Built for teams that move fast and need answers they can trust.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1226] p-6 transition-colors hover:border-white/20"
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-0 transition-opacity group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
                    <Icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </div>
                  <h3 className="font-display mb-2 font-semibold text-white">{feature.title}</h3>
                  <p className="font-body text-sm leading-relaxed text-slate-400">
                    {feature.description}
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
