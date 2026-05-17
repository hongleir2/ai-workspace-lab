'use client';

import { Button } from '@/components/ui/button';
import { captureEvent } from '@ai-workspace-lab/analytics';
import { AlertCircle, FileUp, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

const ALLOWED_EXTENSIONS = ['pdf', 'txt', 'md'] as const;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

interface UploadFormProps {
  orgSlug: string;
}

type UploadState = 'idle' | 'uploading' | 'error';

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function UploadForm({ orgSlug }: UploadFormProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setErrorMessage(null);
    setState('idle');
    setSelectedFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    const ext = getExtension(selectedFile.name);
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      setErrorMessage(`Unsupported file type ".${ext}". Allowed: PDF, TXT, MD.`);
      captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'invalid_file_type' });
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage('File too large. Maximum size is 5 MB.');
      captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'file_too_large' });
      return;
    }

    captureEvent('document_upload_started', {
      org_slug: orgSlug,
      file_type: ext,
      file_size_bytes: selectedFile.size,
    });
    setState('uploading');
    setErrorMessage(null);

    try {
      // Phase 1: get presigned URL from our API
      const metaRes = await fetch(`/api/orgs/${orgSlug}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type || 'application/octet-stream',
          byteSize: selectedFile.size,
        }),
      });

      if (!metaRes.ok) {
        const data = (await metaRes.json()) as { error?: string };
        const isPermanent = [402, 403, 429].includes(metaRes.status);
        if (metaRes.status === 429) {
          setErrorMessage('Document quota reached. Please upgrade your plan to upload more.');
          captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'quota_exceeded' });
        } else if (metaRes.status === 402) {
          setErrorMessage('No active subscription. Please set up billing to upload documents.');
          captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'no_subscription' });
        } else if (metaRes.status === 403) {
          setErrorMessage('Document uploads are not enabled for your account.');
          captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'feature_disabled' });
        } else {
          setErrorMessage(data.error ?? 'Upload failed. Please try again.');
          captureEvent('document_upload_failed', {
            org_slug: orgSlug,
            reason: 'server_error',
            status: metaRes.status,
          });
        }
        if (isPermanent) {
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
        setState('error');
        return;
      }

      const { document, uploadUrl } = (await metaRes.json()) as {
        document: { id: string };
        uploadUrl: string;
      };

      // Phase 2: PUT file to presigned URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
        body: selectedFile,
      });

      if (!putRes.ok) {
        setErrorMessage('Storage upload failed. Please try again.');
        captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'storage_put_failed' });
        setState('error');
        return;
      }

      captureEvent('document_uploaded', {
        org_slug: orgSlug,
        document_id: document.id,
        file_type: ext,
        file_size_bytes: selectedFile.size,
      });

      router.push(`/app/${orgSlug}/documents/${document.id}`);
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
      captureEvent('document_upload_failed', { org_slug: orgSlug, reason: 'network_error' });
      setState('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <button
        type="button"
        className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Select file to upload"
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted ring-1 ring-border/60">
          <FileUp className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {selectedFile ? selectedFile.name : 'Click to select a file'}
          </p>
          <p className="text-xs text-muted-foreground">PDF, TXT, or MD — up to 5 MB</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="sr-only"
          onChange={handleFileChange}
          aria-hidden={true}
          tabIndex={-1}
        />
      </button>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={!selectedFile || state === 'uploading'}
        className="self-start"
      >
        {state === 'uploading' ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Uploading…
          </>
        ) : (
          'Upload Document'
        )}
      </Button>
    </form>
  );
}
