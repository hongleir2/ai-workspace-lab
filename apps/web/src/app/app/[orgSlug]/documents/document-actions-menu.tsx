'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { deleteDocument, renameDocument } from './actions';

interface DocumentActionsMenuProps {
  orgSlug: string;
  documentId: string;
  documentTitle: string;
}

export function DocumentActionsMenu({
  orgSlug,
  documentId,
  documentTitle,
}: DocumentActionsMenuProps) {
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function openRename() {
    setDraftTitle(documentTitle);
    setDialog('rename');
    // focus after dialog renders
    setTimeout(() => inputRef.current?.select(), 50);
  }

  function handleRename() {
    startTransition(async () => {
      await renameDocument(orgSlug, documentId, draftTitle);
      setDialog(null);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteDocument(orgSlug, documentId);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Document actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openRename}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDialog('delete')}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={dialog === 'rename'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <Input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
            disabled={isPending}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isPending || !draftTitle.trim()}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={dialog === 'delete'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              <strong className="font-medium text-foreground">{documentTitle}</strong> will be
              permanently removed from your workspace. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
