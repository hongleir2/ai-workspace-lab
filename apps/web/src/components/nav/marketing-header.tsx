import Link from 'next/link';

import { UserMenu } from '@/components/nav/user-menu';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/user';
import { cn } from '@/lib/utils';

interface MarketingHeaderProps {
  className?: string;
}

const navLinks = [
  { label: 'Product', href: '#' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '#' },
  { label: 'Changelog', href: '#' },
];

export async function MarketingHeader({ className }: MarketingHeaderProps) {
  const user = await getCurrentUser();

  return (
    <header
      className={cn(
        'sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-[#070a15]/80 border-b border-white/10',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="font-semibold tracking-tight text-lg text-white transition-colors hover:text-white/80"
        >
          AI Workspace
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-slate-400 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="cursor-pointer text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Link href="/app">{'Go to app'}</Link>
              </Button>
              <UserMenu
                displayName={user.displayName}
                email={user.email}
                className="text-slate-300 hover:bg-white/10 hover:text-white"
              />
            </>
          ) : (
            <>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="cursor-pointer border-white/20 bg-transparent text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Link href="/sign-in">{'Sign in'}</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="cursor-pointer bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-600 hover:to-blue-600"
              >
                <Link href="/sign-up">{'Get started'}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
