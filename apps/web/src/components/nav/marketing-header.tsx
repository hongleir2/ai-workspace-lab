import Link from 'next/link';

import { Button } from '@/components/ui/button';
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

export function MarketingHeader({ className }: MarketingHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border',
        className,
      )}
    >
      <div className="bg-gradient-to-r from-primary/40 via-primary to-primary/40 h-px" />
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="font-semibold tracking-tight text-lg text-foreground transition-colors hover:text-foreground/80"
        >
          AI Workspace
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="cursor-pointer">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
