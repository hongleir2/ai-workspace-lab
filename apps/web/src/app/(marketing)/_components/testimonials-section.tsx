const testimonials = [
  {
    quote:
      'We used to spend half our standup just answering "where is the spec for X?" Now the team just asks the workspace.',
    author: 'Sarah K.',
    role: 'Engineering Lead',
    initials: 'SK',
  },
  {
    quote:
      'The cited sources make all the difference. I know exactly which document the answer came from, so I can trust it.',
    author: 'Marcus L.',
    role: 'Product Manager',
    initials: 'ML',
  },
  {
    quote:
      'Onboarding new hires went from weeks to days. They can ask questions and get answers from our whole knowledge base.',
    author: 'Priya N.',
    role: 'Head of Operations',
    initials: 'PN',
  },
];

export function TestimonialsSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
            {'Testimonials'}
          </p>
          <h2 className="font-display text-4xl font-bold text-slate-900">{'Teams love it'}</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <p className="font-body mb-6 text-sm leading-relaxed text-slate-600">
                {'“'}
                {t.quote}
                {'”'}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  {t.initials}
                </div>
                <div>
                  <p className="font-display text-sm font-semibold text-slate-900">{t.author}</p>
                  <p className="font-body text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
