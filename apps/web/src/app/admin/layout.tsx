import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-red-200 bg-red-50 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-red-900">Platform Admin</span>
          <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Placeholder shell · requirePlatformAdmin()
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
