interface PlaceholderPageProps {
  title: string;
  route: string;
  priority: 'P0' | 'P1' | 'P2';
  sprint: string;
  backendDeps: readonly string[];
}

const priorityColors: Record<'P0' | 'P1' | 'P2', string> = {
  P0: 'bg-red-100 text-red-800',
  P1: 'bg-orange-100 text-orange-800',
  P2: 'bg-yellow-100 text-yellow-800',
};

export function PlaceholderPage({
  title,
  route,
  priority,
  sprint,
  backendDeps,
}: PlaceholderPageProps) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-lg border border-dashed border-neutral-300 p-8">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Placeholder
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityColors[priority]}`}>
            {priority}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
          <dt className="font-medium text-neutral-500">Route</dt>
          <dd className="font-mono text-neutral-900">{route}</dd>
          <dt className="font-medium text-neutral-500">Priority</dt>
          <dd>{priority}</dd>
          <dt className="font-medium text-neutral-500">Target sprint</dt>
          <dd>{sprint}</dd>
          <dt className="self-start pt-0.5 font-medium text-neutral-500">Backend deps</dt>
          <dd>
            {backendDeps.length > 0 ? (
              <ul className="space-y-0.5">
                {backendDeps.map((dep) => (
                  <li key={dep} className="font-mono text-neutral-600">
                    {dep}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-neutral-400">none</span>
            )}
          </dd>
        </dl>
      </div>
    </main>
  );
}
