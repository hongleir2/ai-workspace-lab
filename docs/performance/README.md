# docs/performance

Performance budgets, benchmark results, capacity-planning notes.

> **Status:** empty. Populate when we have a hosted surface to measure.

Suggested contents:
- `web-budgets.md` — LCP / TTFB / INP targets for `apps/web` per route.
- `api-budgets.md` — p50 / p95 / p99 latency targets per endpoint.
- `db-capacity.md` — connection-pool / row-count limits before we shard.
- `ai-cost.md` — per-request cost ceiling for LLM calls; throttle policy when exceeded.

Treat budgets as **alerts** — exceeding them gets a fix or a documented exception, not a silent slide.
