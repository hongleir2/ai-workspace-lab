'use client';

import { ChevronDown } from 'lucide-react';

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
}

export function UserMenu({ className }: UserMenuProps) {
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
            HL
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 flex flex-col">
          <span className="text-sm font-medium">Honglei Ren</span>
          <span className="text-xs text-muted-foreground">honglei@otter.ai</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">Account</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer">Notifications</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
