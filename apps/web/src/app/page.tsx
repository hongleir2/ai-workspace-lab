export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">AI Workspace</h1>
      <p className="text-neutral-600">
        Phase 0 scaffold. No product features yet — see{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm">
          docs/product/PRD-ai-workspace-saas.md
        </code>
        .
      </p>
    </main>
  );
}
