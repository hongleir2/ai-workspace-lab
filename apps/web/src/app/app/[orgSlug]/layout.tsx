import type { ReactNode } from 'react';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold">AI Workspace</span>
          <span className="text-neutral-400">/</span>
          <span className="font-mono text-sm text-neutral-600">{orgSlug}</span>
          <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Placeholder shell · requireUser() + requireMembership()
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
