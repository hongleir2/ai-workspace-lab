import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { DialogDemo, DropdownDemo } from './_demos';

const swatches = [
  { name: 'background', cls: 'bg-background border border-border' },
  { name: 'foreground', cls: 'bg-foreground' },
  { name: 'card', cls: 'bg-card border border-border' },
  { name: 'primary', cls: 'bg-primary' },
  { name: 'secondary', cls: 'bg-secondary' },
  { name: 'muted', cls: 'bg-muted' },
  { name: 'accent', cls: 'bg-accent' },
  { name: 'destructive', cls: 'bg-destructive' },
  { name: 'border', cls: 'bg-border' },
];

function Block({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="rounded-md border border-border bg-card p-6">{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Design system"
        description="Every primitive in the app, in light and dark mode. Treat this page as the source of truth — if it doesn't render here, it doesn't ship."
        breadcrumbs={[{ label: 'Dev', href: '/dev' }, { label: 'Design system' }]}
      />

      <Tabs defaultValue="foundations" className="mt-8">
        <TabsList>
          <TabsTrigger value="foundations">Foundations</TabsTrigger>
          <TabsTrigger value="primitives">Primitives</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="foundations" className="mt-8 space-y-12">
          <section className="space-y-4">
            <SectionHeader
              title="Color tokens"
              description="All driven by shadcn CSS variables — switching the .dark class on <html> swaps the palette."
            />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {swatches.map((s) => (
                <div key={s.name} className="space-y-2">
                  <div className={`h-16 w-full rounded-md ${s.cls}`} />
                  <div className="font-mono text-[11px] text-muted-foreground">{s.name}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Typography"
              description="Space Grotesk for display, DM Sans for body."
            />
            <Block label="font-display">
              <h1 className="font-display text-4xl font-semibold tracking-tight">
                AI workspace for teams
              </h1>
              <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                that build with knowledge.
              </h2>
            </Block>
            <Block label="font-body / font-mono">
              <p className="text-base">The quick brown fox jumps over the lazy dog. 0123456789.</p>
              <p className="mt-2 font-mono text-sm text-muted-foreground">
                org_2x9aBpQ · doc_7Y2k · sess_5Lm
              </p>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Surfaces"
              description="Dimensional layering with subtle gradient accents."
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-background p-4 text-sm">
                background
              </div>
              <div className="rounded-md border border-border bg-card p-4 shadow-sm text-sm">
                card · shadow-sm
              </div>
              <div className="rounded-md border border-border bg-card p-4 shadow-md text-sm">
                card · shadow-md
              </div>
            </div>
            <div className="bg-grid-pattern bg-grid-fade rounded-md border border-border p-10 text-center text-sm text-muted-foreground">
              .bg-grid-pattern · .bg-grid-fade
            </div>
          </section>
        </TabsContent>

        <TabsContent value="primitives" className="mt-8 space-y-12">
          <section className="space-y-4">
            <SectionHeader title="Buttons" />
            <Block label="variants">
              <div className="flex flex-wrap gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </Block>
            <Block label="sizes">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Add">
                  <Plus />
                </Button>
              </div>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Form fields" />
            <Block label="input + textarea">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="ds-input" className="text-sm font-medium">
                    Email
                  </label>
                  <Input id="ds-input" type="email" placeholder="you@example.com" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ds-textarea" className="text-sm font-medium">
                    Notes
                  </label>
                  <Textarea id="ds-textarea" placeholder="Add a note…" rows={3} />
                </div>
              </div>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Card" />
            <Block label="composition">
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge base</CardTitle>
                  <CardDescription>120 documents · 4.2k chunks indexed</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  All retrieval queries are scoped to the current organization.
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm">Open</Button>
                  <Button size="sm" variant="ghost">
                    Settings
                  </Button>
                </CardFooter>
              </Card>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Badge" />
            <Block label="variants">
              <div className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Alert" />
            <div className="space-y-3">
              <Alert>
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>This is a default alert for informational copy.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>Quota exceeded</AlertTitle>
                <AlertDescription>
                  Upgrade to Pro to keep running AI queries this month.
                </AlertDescription>
              </Alert>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Overlays"
              description="Dialog and dropdown — both client components."
            />
            <Block label="dialog + dropdown">
              <div className="flex flex-wrap gap-3">
                <DialogDemo />
                <DropdownDemo />
              </div>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Tabs" />
            <Block label="three values">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-3 text-sm text-muted-foreground">
                  Overview content placeholder.
                </TabsContent>
                <TabsContent value="activity" className="mt-3 text-sm text-muted-foreground">
                  Activity content placeholder.
                </TabsContent>
                <TabsContent value="settings" className="mt-3 text-sm text-muted-foreground">
                  Settings content placeholder.
                </TabsContent>
              </Tabs>
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Skeleton" />
            <Block label="loading">
              <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </Block>
          </section>
        </TabsContent>

        <TabsContent value="patterns" className="mt-8 space-y-12">
          <section className="space-y-4">
            <SectionHeader title="Page header" />
            <Block label="with breadcrumbs + actions">
              <PageHeader
                title="Documents"
                description="Source documents indexed for AI retrieval."
                breadcrumbs={[{ label: 'Acme Inc', href: '/app/acme' }, { label: 'Documents' }]}
                actions={<Button size="sm">Upload</Button>}
              />
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Section header" />
            <Block label="default">
              <SectionHeader
                title="Recent activity"
                description="Last 30 days across the workspace."
                actions={
                  <Button size="sm" variant="ghost">
                    View all
                  </Button>
                }
              />
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Empty state" />
            <Block label="no documents">
              <EmptyState
                title="No documents yet"
                description="Upload a PDF, paste a URL, or connect a source to start indexing."
                action={<Button size="sm">Add document</Button>}
              />
            </Block>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Loading state" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Block label="skeleton (default)">
                <LoadingState rows={3} />
              </Block>
              <Block label="spinner">
                <LoadingState variant="spinner" message="Indexing your documents…" />
              </Block>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader title="Error state" />
            <Block label="with error">
              <ErrorState
                title="Couldn't load documents"
                description="The retrieval service is unreachable. Retry in a moment."
                action={
                  <Button size="sm" variant="outline">
                    Retry
                  </Button>
                }
              />
            </Block>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
