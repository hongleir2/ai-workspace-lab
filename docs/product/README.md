# docs/product

Product specs and design artifacts. Source of truth for what we're building (the *what*) — separate from `docs/adr/` (the *why* / decisions) and `docs/runbooks/` (the *how to operate*).

## Contents

- [`prd.md`](./prd.md) — Long-form product requirements doc.
- [`erd.md`](./erd.md) — Entity relationship / data model.
- [`frontend-page-map.md`](./frontend-page-map.md) — Source of truth for every frontend route (priority, sprint, backend deps, analytics, authz).
- [`implementation-principles.md`](./implementation-principles.md) — Non-negotiable invariants for every implementation in this repo.
- [`open-questions.md`](./open-questions.md) — Tracking unresolved product/architecture questions.
- [`sprint-plan.md`](./sprint-plan.md) — Sprint-by-sprint delivery plan.
- [`sprint-by-sprint-erd.md`](./sprint-by-sprint-erd.md) — ERD evolution mapped to each sprint.

PRDs are living documents — update in place rather than versioning. If a major direction shift is needed, write an ADR explaining the change and reference this PRD.
