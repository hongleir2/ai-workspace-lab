'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { captureEvent } from '@ai-workspace-lab/analytics';
import { useChat } from 'ai/react';
import { Bot, FileText, Loader2, Send, User } from 'lucide-react';
import Link from 'next/link';
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useRef } from 'react';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatQuota {
  limit: number | null;
  used: number | null;
  unlimited: boolean;
  exceeded: boolean;
  resetSummary: string | null;
}

interface ChatInterfaceProps {
  orgSlug: string;
  sessionId: string;
  initialMessages: AiChatMessage[];
  quota: AiChatQuota | null;
  documentId?: string;
  documentName?: string;
}

function quotaLabel(quota: AiChatQuota | null): string {
  if (!quota) return 'Quota unavailable';
  if (quota.unlimited || quota.limit === null) return 'Unlimited';
  if (quota.used === null) return `${quota.limit} message limit`;
  return `${quota.used} / ${quota.limit}`;
}

function MessageRow({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className="flex items-start gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

export function ChatInterface({
  orgSlug,
  sessionId,
  initialMessages,
  quota,
  documentId,
  documentName,
}: ChatInterfaceProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(initialMessages.some((message) => message.role === 'user'));
  const quotaTrackedRef = useRef(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: `/api/orgs/${orgSlug}/chat`,
    body: { sessionId, ...(documentId ? { documentId } : {}) },
    initialMessages,
    onError: (chatError: unknown) => {
      captureEvent('ai_chat_failed', {
        org_slug: orgSlug,
        session_id: sessionId,
        error: chatError instanceof Error ? chatError.message : String(chatError),
      });
    },
    onFinish: (message) => {
      captureEvent('ai_chat_completed', {
        org_slug: orgSlug,
        session_id: sessionId,
        assistant_message_id: message.id,
      });
    },
  }) as {
    messages: AiChatMessage[];
    input: string;
    handleInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
    isLoading: boolean;
    error: unknown;
  };

  useEffect(() => {
    if (!startedRef.current && messages.some((message: AiChatMessage) => message.role === 'user')) {
      startedRef.current = true;
      captureEvent('ai_chat_started', {
        org_slug: orgSlug,
        session_id: sessionId,
      });
    }
  }, [messages, orgSlug, sessionId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length is intentional — scroll on new messages only
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (quota?.exceeded && !quotaTrackedRef.current) {
      quotaTrackedRef.current = true;
      captureEvent('quota_exceeded', {
        org_slug: orgSlug,
        session_id: sessionId,
      });
    }
  }, [orgSlug, quota?.exceeded, sessionId]);

  function submitChat(event: FormEvent<HTMLFormElement>) {
    if (quota?.exceeded) {
      captureEvent('quota_exceeded', {
        org_slug: orgSlug,
        session_id: sessionId,
        attempted_send: true,
      });
      return;
    }

    if (!startedRef.current && input.trim().length > 0) {
      startedRef.current = true;
      captureEvent('ai_chat_started', {
        org_slug: orgSlug,
        session_id: sessionId,
      });
    }

    handleSubmit(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  const canSend = !isLoading && input.trim().length > 0 && !quota?.exceeded;
  const quotaText = quotaLabel(quota);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={quota?.exceeded ? 'destructive' : 'secondary'}>{quotaText}</Badge>
          {quota?.resetSummary ? (
            <span className="text-xs text-muted-foreground">{quota.resetSummary}</span>
          ) : null}
          {documentId ? (
            <Badge variant="outline" className="gap-1.5">
              <FileText className="size-3" />
              {documentName ?? 'Document context'}
            </Badge>
          ) : null}
        </div>
        {quota?.exceeded ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/${orgSlug}/settings/billing`}>Upgrade plan</Link>
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-[30rem] flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                Start a conversation to ask this workspace a question.
              </p>
            </div>
          ) : (
            messages.map((message: AiChatMessage) => (
              <MessageRow key={message.id} message={message} />
            ))
          )}
          <div ref={endRef} />
        </div>

        <form ref={formRef} onSubmit={submitChat} className="flex flex-col gap-3">
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={quota?.exceeded ? 'Upgrade to keep chatting' : 'Type a message'}
            rows={3}
            disabled={quota?.exceeded}
            className="resize-none"
          />
          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={!canSend}>
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Send
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive">
              Something went wrong sending this message. Please try again.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
