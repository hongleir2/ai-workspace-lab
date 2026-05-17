import { Badge } from '@/components/ui/badge';
import { db, desc, inArray, jobs } from '@ai-workspace-lab/db';

export const dynamic = 'force-dynamic';

export default async function AdminJobsPage() {
  const failedJobs = await db
    .select()
    .from(jobs)
    .where(inArray(jobs.status, ['failed', 'dead_lettered', 'retrying']))
    .orderBy(desc(jobs.updatedAt))
    .limit(50);

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">Failed, dead-lettered, and retrying jobs</p>
      </div>

      {failedJobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No failed jobs — everything is healthy.</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {failedJobs.map((job) => {
            const formatted = job.updatedAt.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div key={job.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-medium">{job.jobType}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatted}</span>
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">{job.id}</div>
                {job.lastErrorCode ? (
                  <div className="text-xs">
                    <span className="font-medium text-destructive">{job.lastErrorCode}</span>
                    {job.lastErrorMessage ? (
                      <span className="text-muted-foreground ml-2">{job.lastErrorMessage}</span>
                    ) : null}
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  Attempt {job.attemptsCount}/{job.maxAttempts}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'dead_lettered') return <Badge variant="destructive">Dead-lettered</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  if (status === 'retrying')
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Retrying</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}
