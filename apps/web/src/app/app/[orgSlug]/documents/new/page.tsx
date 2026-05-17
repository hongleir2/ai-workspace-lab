import { requireMembership } from '@/lib/orgs/guards';
import Link from 'next/link';
import { UploadForm } from './upload-form';

interface UploadDocumentPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function UploadDocumentPage({ params }: UploadDocumentPageProps) {
  const { orgSlug } = await params;
  await requireMembership(orgSlug);

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <Link
          href={`/app/${orgSlug}/documents`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Documents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Upload Document</h1>
        <p className="text-sm text-muted-foreground">
          Upload a PDF, plain text, or Markdown file. Files are processed in the background.
        </p>
      </div>
      <UploadForm orgSlug={orgSlug} />
    </div>
  );
}
