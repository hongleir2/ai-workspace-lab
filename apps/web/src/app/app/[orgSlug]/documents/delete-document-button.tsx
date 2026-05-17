'use client';

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
import { deleteDocument } from './actions';

interface DeleteDocumentButtonProps {
  orgSlug: string;
  documentId: string;
  documentTitle: string;
  variant?: 'icon' | 'full';
}

export function DeleteDocumentButton({
  orgSlug,
  documentId,
  documentTitle,
  variant = 'full',
}: DeleteDocumentButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteDocument(orgSlug, documentId);
    });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${documentTitle}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : (
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="size-4" />
            Delete document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            <strong className="font-medium text-foreground">{documentTitle}</strong> will be
            permanently removed from your workspace. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => {}}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
