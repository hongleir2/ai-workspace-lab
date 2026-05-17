# docs/runbooks

Operational runbooks: how to handle incidents, run migrations, rotate keys, recover from failure.

Suggested file naming: `<surface>-<scenario>.md` — e.g., `stripe-webhook-replay.md`, `db-migration-rollback.md`, `quota-exhausted.md`.

Each runbook should answer:
1. **Symptom** — what does the alert / page look like?
2. **Diagnose** — commands / dashboards to identify the cause.
3. **Mitigate** — fastest way to stop the bleeding.
4. **Fix** — root-cause resolution.
5. **Postmortem trigger** — when does this incident demand a write-up.

## Index

| Runbook | Surface |
|---|---|
| [`stripe-webhook-runbook.md`](./stripe-webhook-runbook.md) | Stripe webhook failures, duplicate events, idempotency |
| [`r2-storage-runbook.md`](./r2-storage-runbook.md) | Cloudflare R2 setup, CORS errors, credential rotation, upload failures |
