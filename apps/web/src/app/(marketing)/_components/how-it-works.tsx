const steps = [
  {
    number: '01',
    title: 'Upload your documents',
    description:
      'Drag and drop PDFs, text files, and markdown. We process them automatically into a searchable index for your team.',
  },
  {
    number: '02',
    title: 'Ask in plain English',
    description:
      'Type any question. Our AI searches across all your documents simultaneously and surfaces the most relevant answers.',
  },
  {
    number: '03',
    title: 'Get cited answers',
    description:
      'Every answer links back to the exact document and section it came from — so you can verify and trust the results.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
            {'How it works'}
          </p>
          <h2 className="font-display text-4xl font-bold text-foreground">
            {'From upload to answer in seconds'}
          </h2>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />

          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 shadow-lg shadow-indigo-500/10">
                <span className="font-display text-xl font-bold text-indigo-500 dark:text-indigo-400">
                  {step.number}
                </span>
              </div>
              <h3 className="font-display mb-3 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
