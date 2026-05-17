export function ProductDemo() {
  const files = [
    { name: 'Q3 Roadmap.pdf', size: '1.2 MB', status: 'indexed' },
    { name: 'Product Spec v2.pdf', size: '3.4 MB', status: 'indexed' },
    { name: 'Engineering Handbook.pdf', size: '890 KB', status: 'indexed' },
    { name: 'Investor Update.pdf', size: '512 KB', status: 'indexed' },
  ];

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="font-body mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-400">
            {'Demo'}
          </p>
          <h2 className="font-display text-4xl font-bold text-white">
            {'See AI Workspace in action'}
          </h2>
          <p className="font-body mt-3 text-slate-400">
            {'Your entire knowledge base, one question away.'}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1226] shadow-2xl shadow-black/60">
          {/* Chrome */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-12 py-1 text-xs text-slate-500">
              {'app.aiworkspace.io'}
            </div>
            <div className="w-16" />
          </div>

          {/* App layout */}
          <div className="flex" style={{ minHeight: '400px' }}>
            {/* Left nav */}
            <div className="w-52 shrink-0 border-r border-white/10 p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-indigo-600" />
                <span className="text-sm font-semibold text-white">{'Acme Corp'}</span>
              </div>
              {['Documents', 'AI Chat', 'Members', 'Usage', 'Settings'].map((item, i) => (
                <div
                  key={item}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-xs ${
                    i === 0
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-indigo-400' : 'bg-slate-700'}`}
                  />
                  {item}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col">
              {/* Header */}
              <div className="border-b border-white/10 px-6 py-3">
                <h3 className="text-sm font-semibold text-white">{'Documents'}</h3>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-auto p-4">
                <div className="mb-3 grid grid-cols-3 px-3 text-xs font-medium uppercase tracking-wider text-slate-600">
                  <span>{'Name'}</span>
                  <span className="text-center">{'Size'}</span>
                  <span className="text-right">{'Status'}</span>
                </div>
                {files.map((file) => (
                  <div
                    key={file.name}
                    className="mb-1 grid grid-cols-3 items-center rounded-lg px-3 py-2.5 text-xs hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 shrink-0 rounded-md bg-indigo-500/20 p-1.5">
                        <div className="h-full w-full rounded-sm bg-indigo-400/60" />
                      </div>
                      <span className="text-slate-300">{file.name}</span>
                    </div>
                    <span className="text-center text-slate-600">{file.size}</span>
                    <div className="flex justify-end">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400">
                        {'Indexed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat panel */}
            <div className="w-80 shrink-0 border-l border-white/10 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-600">
                {'AI Chat'}
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-300">
                    {'U'}
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-300">
                    {'Summarize the key product decisions from Q3'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {'AI'}
                  </div>
                  <div className="space-y-1.5">
                    <div className="rounded-xl bg-indigo-500/10 px-3 py-2 text-xs leading-relaxed text-slate-300">
                      {
                        'Q3 focused on three key decisions: (1) API-first architecture, (2) shift to async document processing, and (3) team-level billing...'
                      }
                    </div>
                    <div className="flex items-center gap-1.5 px-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      <span className="text-xs text-indigo-400">{'3 sources cited'}</span>
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
