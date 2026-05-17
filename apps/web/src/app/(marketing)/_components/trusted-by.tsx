const companies = ['Linear', 'Notion', 'Vercel', 'Figma', 'Stripe', 'PostHog', 'Raycast'];

export function TrustedBy() {
  return (
    <section className="border-y border-border px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="font-body mb-8 text-center text-sm text-muted-foreground">
          {'Trusted by founders, operators, and AI teams'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {companies.map((company) => (
            <span
              key={company}
              className="font-display text-sm font-semibold tracking-wide text-muted-foreground"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
