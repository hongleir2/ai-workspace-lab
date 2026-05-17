import { BarChart2, BrainCircuit, Clock, FileUp, ShieldCheck, Users } from 'lucide-react';

const features = [
  {
    icon: FileUp,
    title: 'Instant document upload',
    description:
      'Upload PDFs and text files — processed automatically into a searchable index within seconds.',
  },
  {
    icon: BrainCircuit,
    title: 'AI-powered Q&A',
    description:
      'Ask questions in plain English and get precise answers pulled directly from your documents.',
  },
  {
    icon: Users,
    title: 'Team workspaces',
    description:
      'Organize documents by organization. Every member can search and ask across the shared library.',
  },
  {
    icon: BarChart2,
    title: 'Usage visibility',
    description:
      'Track document count, AI queries, and storage usage. See exactly where your team stands.',
  },
  {
    icon: Clock,
    title: 'Async processing',
    description:
      'Large documents are processed in the background — no waiting, no timeouts for your team.',
  },
  {
    icon: ShieldCheck,
    title: 'Plan-based access',
    description:
      'Start free and upgrade when you need more. Entitlements are enforced server-side, always.',
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-slate-50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            {'Features'}
          </p>
          <h2 className="font-display text-4xl font-bold text-slate-900">
            {'Everything your team needs'}
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-display mb-2 font-semibold text-slate-900">{feature.title}</h3>
                <p className="font-body text-sm leading-relaxed text-slate-600">
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
