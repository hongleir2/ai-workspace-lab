import { Bell, Search } from 'lucide-react';

import { UserMenu } from '@/components/nav/user-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface AppTopbarProps {
  orgSlug: string;
  className?: string;
  userDisplayName?: string | null;
  userEmail?: string;
}

export function AppTopbar({
  orgSlug: _orgSlug,
  className,
  userDisplayName,
  userEmail,
}: AppTopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border',
        className,
      )}
    >
      <div className="h-14 flex items-center gap-3 px-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search documents, chats…"
            className="h-9 pl-9 bg-card"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          </button>
          <UserMenu
            {...(userDisplayName !== undefined ? { displayName: userDisplayName } : {})}
            {...(userEmail !== undefined ? { email: userEmail } : {})}
          />
        </div>
      </div>
    </header>
  );
}
