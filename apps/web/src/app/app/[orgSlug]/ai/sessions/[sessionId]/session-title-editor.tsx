'use client';

import { updateSessionTitle } from '@/app/app/[orgSlug]/ai/actions';
import { useEffect, useRef, useState, useTransition } from 'react';

interface SessionTitleEditorProps {
  orgSlug: string;
  sessionId: string;
  initialTitle: string;
}

export function SessionTitleEditor({ orgSlug, sessionId, initialTitle }: SessionTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(initialTitle);
  const [draftTitle, setDraftTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const committingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraftTitle(displayTitle);
    setEditing(true);
  }

  function commit() {
    if (committingRef.current) return;
    committingRef.current = true;

    const trimmed = draftTitle.trim() || displayTitle;
    setEditing(false);

    if (trimmed !== displayTitle) {
      setDisplayTitle(trimmed);
      startTransition(async () => {
        await updateSessionTitle(orgSlug, sessionId, trimmed);
        committingRef.current = false;
      });
    } else {
      committingRef.current = false;
    }
  }

  function cancel() {
    committingRef.current = false;
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            cancel();
          }
        }}
        onBlur={commit}
        disabled={isPending}
        aria-label="Session title"
        className="w-full bg-transparent border-b-2 border-primary text-2xl font-semibold tracking-tight outline-none truncate"
      />
    );
  }

  return (
    <h1
      className="truncate text-2xl font-semibold tracking-tight cursor-text"
      onDoubleClick={startEditing}
      title="Double-click to rename"
    >
      {displayTitle}
      {isPending ? (
        <span className="ml-2 text-sm font-normal text-muted-foreground">Saving…</span>
      ) : null}
    </h1>
  );
}
