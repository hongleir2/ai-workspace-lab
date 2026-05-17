const stats = [
  {
    value: '99.9%',
    label: 'Uptime SLA',
    description: 'Reliable infrastructure built on Vercel + Supabase',
  },
  {
    value: '<30s',
    label: 'Processing time',
    description: 'Most documents indexed in under 30 seconds',
  },
  {
    value: '100%',
    label: 'Data isolation',
    description: 'Every organization is fully isolated at the DB level',
  },
  {
    value: 'SOC 2',
    label: 'Ready',
    description: 'Built with compliance-ready patterns from day one',
  },
];

export function ReliabilitySection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            {'Reliability'}
          </p>
          <h2 className="font-display text-4xl font-bold text-white">
            {'Built with reliability in mind'}
          </h2>
          <p className="font-body mt-3 text-slate-400">
            {'Enterprise-grade infrastructure so your team can depend on it.'}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-[#0d1226] p-6 text-center"
            >
              <div className="font-display mb-1 text-4xl font-bold text-white">{stat.value}</div>
              <div className="font-display mb-2 text-sm font-semibold text-indigo-400">
                {stat.label}
              </div>
              <p className="font-body text-xs leading-relaxed text-slate-500">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
