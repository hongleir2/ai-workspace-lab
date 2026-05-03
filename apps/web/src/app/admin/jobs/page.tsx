import { PlaceholderPage } from '@/components/placeholder-page';

export default function AdminJobsPage() {
  return (
    <PlaceholderPage
      title="Jobs admin"
      route="/admin/jobs"
      priority="P1"
      sprint="11"
      backendDeps={['jobs', 'job_errors']}
    />
  );
}
