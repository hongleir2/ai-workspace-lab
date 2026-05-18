'use client';

import { deleteSession } from '@/app/app/[orgSlug]/ai/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';

interface DeleteSessionButtonProps {
  orgSlug: string;
  sessionId: string;
  sessionTitle: string;
}

export function DeleteSessionButton({
  orgSlug,
  sessionId,
  sessionTitle,
}: DeleteSessionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteSession(orgSlug, sessionId);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${sessionTitle}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete chat?</DialogTitle>
          <DialogDescription>
            <strong className="font-medium text-foreground">{sessionTitle}</strong> and all its
            messages will be permanently removed. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
