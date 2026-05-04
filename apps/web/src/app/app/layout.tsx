import { requireUser } from '@/lib/auth/user';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
