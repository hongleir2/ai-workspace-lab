import { PageAnalytics } from '@/components/page-analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getServerFeatureFlag } from '@/lib/analytics/flags';
import { requireMembership } from '@/lib/orgs/guards';
import { checkEntitlement, getOrganizationUsageOverview } from '@ai-workspace-lab/entitlements';
import { CheckCircle2, Circle, ExternalLink, FileText, Lock, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface OrgDashboardPageProps {
  params: Promise<{ orgSlug: string }>;
}

interface ChecklistItem {
  label: string;
  description: string;
  href: string;
  done: boolean;
  /** PostHog flag: feature is rolled out to this user */
  featureEnabled: boolean;
  /** Plan entitlement: feature is included in the org's plan */
  entitled: boolean;
}

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps) {
  const { orgSlug } = await params;
  const { user, organization } = await requireMembership(orgSlug);

  const [overview, uploadEnabled, aiChatEnabled, uploadEntitled, aiChatEntitled] =
    await Promise.all([
      getOrganizationUsageOverview(organization.id).catch(() => null),
      getServerFeatureFlag('document_upload_enabled', user.id),
      getServerFeatureFlag('ai_chat_enabled', user.id),
      checkEntitlement(organization.id, 'document_uploads').catch(() => false),
      checkEntitlement(organization.id, 'ai_chat').catch(() => false),
    ]);

  const isFree =
    !overview ||
    overview.subscription.status === 'free' ||
    overview.plan.billingInterval === 'none';

  const checklist: ChecklistItem[] = [
    {
      label: 'Upload your first document',
      description: 'Add a PDF, Word doc, or text file to start asking AI questions.',
      href: `/app/${orgSlug}/documents/new`,
      done: false,
      featureEnabled: uploadEnabled,
      entitled: uploadEntitled,
    },
    {
      label: 'Ask an AI question',
      description: 'Query across your documents with cited answers.',
      href: `/app/${orgSlug}/ai`,
      done: false,
      featureEnabled: aiChatEnabled,
      entitled: aiChatEntitled,
    },
    {
      label: 'Review your usage',
      description: "See your plan limits and how much you've used.",
      href: `/app/${orgSlug}/settings/usage`,
      done: false,
      featureEnabled: true,
      entitled: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <PageAnalytics event="dashboard_viewed" properties={{ org_slug: orgSlug }} />

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {`Welcome to ${organization.name}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {"Here's an overview of your workspace."}
        </p>
      </div>

      {/* Top row: org info + plan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{'Organization'}</CardDescription>
            <CardTitle className="text-lg">{organization.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {'Slug: '}
              <span className="font-mono text-foreground">{organization.slug}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{'Current plan'}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-lg">
              {overview?.plan.name ?? 'Free'}
              <Badge variant={isFree ? 'secondary' : 'default'}>
                {overview?.subscription.status ?? 'free'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isFree ? (
              <Link href={`/app/${orgSlug}/settings/billing`}>
                <Button size="sm" variant="outline">
                  {'Upgrade plan'}
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">
                {overview?.plan.billingInterval === 'month' ? 'Monthly billing' : 'Annual billing'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage summary */}
      {overview && overview.lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{'Usage this period'}</CardTitle>
            <CardDescription>{'Your consumption against plan limits.'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {overview.lines.map((line) => (
              <div key={line.featureKey} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{line.title}</span>
                  <span className="text-muted-foreground">
                    {line.unlimited
                      ? 'Unlimited'
                      : line.limitUnit === 'bytes'
                        ? `${line.limit} MB max`
                        : `${line.used ?? 0} / ${line.limit}`}
                  </span>
                </div>
                {!line.unlimited && line.limit !== null && line.limitUnit === 'count' && (
                  <div className="h-1.5 w-full rounded-full bg-secondary">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{ width: `${line.percentUsed ?? 0}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{line.resetSummary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Placeholders: recent docs + recent AI sessions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {'Recent documents'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {'No documents yet. '}
              {uploadEnabled && uploadEntitled ? (
                <Link
                  href={`/app/${orgSlug}/documents/new`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {'Upload your first document'}
                </Link>
              ) : uploadEnabled && !uploadEntitled ? (
                'Document uploads are not enabled for your account.'
              ) : (
                'Document upload coming soon.'
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {'Recent AI sessions'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {'No sessions yet. '}
              {aiChatEnabled ? (
                <Link
                  href={`/app/${orgSlug}/ai`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {'Start an AI conversation'}
                </Link>
              ) : (
                'AI chat coming soon.'
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Getting started checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{'Getting started'}</CardTitle>
          <CardDescription>{'Complete these steps to activate your workspace.'}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {checklist.map((item) => {
            if (item.featureEnabled && item.entitled) {
              return (
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
              );
            }
            if (item.featureEnabled && !item.entitled) {
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 py-4 first:pt-0 last:pb-0 opacity-60"
                >
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {'Not included in your plan. '}
                      <Link
                        href={`/app/${orgSlug}/settings/billing`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {'Upgrade'}
                      </Link>
                    </span>
                  </div>
                </div>
              );
            }
            return (
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
            );
          })}
        </CardContent>
      </Card>

      {/* Upgrade CTA for free plans */}
      {isFree && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">{'Unlock more with a paid plan'}</CardTitle>
            <CardDescription>
              {'Get higher limits, priority support, and access to advanced AI features.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/app/${orgSlug}/settings/billing`}>
              <Button>{'View plans & pricing'}</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
