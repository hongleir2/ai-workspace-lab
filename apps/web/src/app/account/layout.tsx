import { requireUser } from '@/lib/auth/user';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

interface AccountLayoutProps {
  children: ReactNode;
}

export default async function AccountLayout({ children }: AccountLayoutProps) {
  await requireUser();
  return <>{children}</>;
}
