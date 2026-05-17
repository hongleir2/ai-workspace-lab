export function ProductDemo() {
  const files = [
    { name: 'Q3 Roadmap.pdf', size: '1.2 MB' },
    { name: 'Product Spec v2.pdf', size: '3.4 MB' },
    { name: 'Engineering Handbook.pdf', size: '890 KB' },
    { name: 'Investor Update.pdf', size: '512 KB' },
  ];

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
            {'Demo'}
          </p>
          <h2 className="font-display text-4xl font-bold text-foreground">
            {'See AI Workspace in action'}
          </h2>
          <p className="font-body mt-3 text-muted-foreground">
            {'Your entire knowledge base, one question away.'}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20">
          {/* Chrome */}
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <div className="rounded-md border border-border bg-background px-12 py-1 text-xs text-muted-foreground">
              {'app.aiworkspace.io'}
            </div>
            <div className="w-16" />
          </div>

          {/* App layout */}
          <div className="flex" style={{ minHeight: '400px' }}>
            {/* Left nav */}
            <div className="w-52 shrink-0 border-r border-border bg-muted/30 p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-indigo-600" />
                <span className="text-sm font-semibold text-foreground">{'Acme Corp'}</span>
              </div>
              {['Documents', 'AI Chat', 'Members', 'Usage', 'Settings'].map((item, i) => (
                <div
                  key={item}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-xs ${
                    i === 0
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-border'}`}
                  />
                  {item}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col">
              <div className="border-b border-border px-6 py-3">
                <h3 className="text-sm font-semibold text-foreground">{'Documents'}</h3>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="mb-3 grid grid-cols-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span>{'Name'}</span>
                  <span className="text-center">{'Size'}</span>
                  <span className="text-right">{'Status'}</span>
                </div>
                {files.map((file) => (
                  <div
                    key={file.name}
                    className="mb-1 grid grid-cols-3 items-center rounded-lg px-3 py-2.5 text-xs hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 shrink-0 rounded-md bg-indigo-500/15 p-1.5">
                        <div className="h-full w-full rounded-sm bg-indigo-500/50" />
                      </div>
                      <span className="text-foreground">{file.name}</span>
                    </div>
                    <span className="text-center text-muted-foreground">{file.size}</span>
                    <div className="flex justify-end">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                        {'Indexed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat panel */}
            <div className="w-80 shrink-0 border-l border-border p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {'AI Chat'}
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                    {'U'}
                  </div>
                  <div className="rounded-xl bg-muted px-3 py-2 text-xs text-foreground">
                    {'Summarize the key product decisions from Q3'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {'AI'}
                  </div>
                  <div className="space-y-1.5">
                    <div className="rounded-xl bg-indigo-500/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                      {
                        'Q3 focused on three key decisions: (1) API-first architecture, (2) shift to async document processing, and (3) team-level billing...'
                      }
                    </div>
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span className="text-xs text-indigo-500 dark:text-indigo-400">
                        {'3 sources cited'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
