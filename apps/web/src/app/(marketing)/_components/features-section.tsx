import { BarChart2, BrainCircuit, Clock, FileUp, ShieldCheck, Users } from 'lucide-react';

const features = [
  {
    icon: FileUp,
    title: 'Instant document upload',
    description:
      'Upload PDFs and text files — processed automatically into a searchable index within seconds.',
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-500/10',
  },
  {
    icon: BrainCircuit,
    title: 'AI-powered Q&A',
    description:
      'Ask questions in plain English and get precise answers pulled directly from your documents.',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
  },
  {
    icon: Users,
    title: 'Team workspaces',
    description:
      'Organize documents by organization. Every member can search and ask across the shared library.',
    iconColor: 'text-violet-500',
    iconBg: 'bg-violet-500/10',
  },
  {
    icon: BarChart2,
    title: 'Usage visibility',
    description:
      'Track document count, AI queries, and storage usage. See exactly where your team stands.',
    iconColor: 'text-cyan-500',
    iconBg: 'bg-cyan-500/10',
  },
  {
    icon: Clock,
    title: 'Async processing',
    description:
      'Large documents are processed in the background — no waiting, no timeouts for your team.',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
  },
  {
    icon: ShieldCheck,
    title: 'Plan-based access',
    description:
      'Start free and upgrade when you need more. Entitlements are enforced server-side, always.',
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-500/10',
  },
];

export function FeaturesSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
            {'Features'}
          </p>
          <h2 className="font-display text-4xl font-bold text-foreground">
            {'Everything you need for intelligent document use'}
          </h2>
          <p className="font-body mt-3 text-muted-foreground">
            {'Built for teams that move fast and need answers they can trust.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-muted/50"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${feature.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${feature.iconColor}`} />
                </div>
                <h3 className="font-display mb-2 font-semibold text-foreground">{feature.title}</h3>
                <p className="font-body text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
