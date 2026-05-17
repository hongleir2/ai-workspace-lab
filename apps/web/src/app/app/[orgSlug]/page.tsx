import { PageAnalytics } from '@/components/page-analytics';
import { getServerFeatureFlag } from '@/lib/analytics/flags';
import { requireUser } from '@/lib/auth/user';
import { getOrganizationBySlug } from '@/lib/orgs/service';
import { CheckCircle2, Circle, ExternalLink, Lock } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

interface OrgDashboardPageProps {
  params: Promise<{ orgSlug: string }>;
}

interface ChecklistItem {
  label: string;
  description: string;
  href: string;
  done: boolean;
  enabled: boolean;
}

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps) {
  const { orgSlug } = await params;
  const [organization, user] = await Promise.all([getOrganizationBySlug(orgSlug), requireUser()]);
  if (!organization) notFound();

  const [uploadEnabled, aiChatEnabled] = await Promise.all([
    getServerFeatureFlag('document_upload_enabled', user.id),
    getServerFeatureFlag('ai_chat_enabled', user.id),
  ]);

  const checklist: ChecklistItem[] = [
    {
      label: 'Upload your first document',
      description: 'Add a PDF, Word doc, or text file to start asking AI questions.',
      href: `/app/${orgSlug}/documents/new`,
      done: false,
      enabled: uploadEnabled,
    },
    {
      label: 'Ask an AI question',
      description: 'Query across your documents with cited answers.',
      href: `/app/${orgSlug}/ai`,
      done: false,
      enabled: aiChatEnabled,
    },
    {
      label: 'Review your usage',
      description: "See your plan limits and how much you've used.",
      href: `/app/${orgSlug}/settings/usage`,
      done: false,
      enabled: true,
    },
  ];

  return (
    <div className="flex flex-col gap-8 p-6 max-w-3xl">
      <PageAnalytics event="dashboard_viewed" properties={{ org_slug: orgSlug }} />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {`Welcome to ${organization.name}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s how to get the most out of your workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{'Getting started'}</CardTitle>
          <CardDescription>{'Complete these steps to activate your workspace.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {checklist.map((item) =>
            item.enabled ? (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-start gap-3 py-4 first:pt-0 last:pb-0 hover:text-foreground transition-colors"
              >
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                )}
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </div>
                <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ) : (
              <div
                key={item.label}
                className="flex items-start gap-3 py-4 first:pt-0 last:pb-0 opacity-50"
              >
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </div>
                <span className="text-xs text-muted-foreground">{'Coming soon'}</span>
              </div>
            ),
          )}
        </CardContent>
      </Card>
    </div>
  );
}
