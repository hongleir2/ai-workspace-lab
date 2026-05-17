'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { signOutAction } from '@/app/(auth)/sign-out/actions';
import { ThemeToggle, useThemeToggle } from '@/components/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  className?: string;
  displayName?: string | null;
  email?: string;
}

function getInitials(displayName: string | null | undefined, email: string | undefined): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }
  return (email ?? 'U?').slice(0, 2).toUpperCase();
}

export function UserMenu({ className, displayName, email }: UserMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initials = getInitials(displayName, email);
  const toggleTheme = useThemeToggle();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-9 px-2 gap-2 inline-flex items-center rounded-md cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground',
            className,
          )}
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 flex flex-col">
          {displayName && <span className="text-sm font-medium">{displayName}</span>}
          {email && <span className="text-xs text-muted-foreground">{email}</span>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => router.push('/account/profile')}
        >
          {'Profile'}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push('/account')}>
          {'Account'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => router.push('/account/notifications')}
        >
          {'Notifications'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={toggleTheme}>
          <ThemeToggle />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          disabled={isPending}
          onSelect={handleSignOut}
        >
          {isPending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
