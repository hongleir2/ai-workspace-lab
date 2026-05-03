# 0003 — App shells, UI primitives, and the dev design-system page

**Date:** 2026-W18
**Status:** Accepted
**Branch:** `feature/shared-layouts-nav` (stacked on `feature/mvp-route-placeholders`)

## Why this entry exists

Phase-0 left us with 21 placeholder routes and shadcn's 10 primitives sitting in a folder. None of it was wired into a real visual frame: no shared layouts, no navigation, no way to see the primitives side-by-side, no design language beyond "shadcn defaults." This pass turns that scaffolding into something you can actually walk through in a browser.

The work is intentionally scoped to **structure and chrome**, not features. Every layout uses placeholder data; every nav component renders a hardcoded user / org / plan. The point is to make the next sprint — auth, onboarding, real data — drop into a finished frame instead of bolting a frame on later.

---

## What changed

### 1. Shared layouts (5 of them)

| Layout                        | Purpose                                              | Distinguishing feature                              |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `(marketing)/layout.tsx`      | Public pages: `/`, `/pricing`                        | `MarketingHeader` + `MarketingFooter`               |
| `(auth)/layout.tsx`           | `/sign-in`, `/sign-up`                               | Centered card on mesh-gradient background          |
| `onboarding/layout.tsx`       | First-run flow                                       | Branded header, no nav (focus mode)                 |
| `app/[orgSlug]/layout.tsx`    | The product itself                                   | `AppSidebar` (240px) + glass `AppTopbar`            |
| `admin/layout.tsx`            | Platform admin                                       | `AdminSidebar` with red-accent "Platform Admin" mark |

Marketing and auth use **route groups** (`(marketing)`, `(auth)`) so the URL stays clean (`/pricing`, not `/marketing/pricing`). Page files moved via `git mv` to preserve history.

### 2. UI primitives (15 total)

10 from shadcn (`pnpm dlx shadcn add ...`): Button, Input, Textarea, Card, Badge, Alert, Dialog, DropdownMenu, Tabs, Skeleton.

5 written by hand in `apps/web/src/components/ui/`:

- `EmptyState` — dashed-border block with optional icon, title, description, action slot
- `ErrorState` — wraps `Alert variant="destructive"` with a consistent retry slot
- `LoadingState` — `variant: 'spinner' | 'skeleton'`, uses semantic `<output>` for screen readers
- `PageHeader` — breadcrumbs + h1 + description + actions, with bottom border
- `SectionHeader` — h2/h3 (level prop) + description + actions, no border

Why these five and not others: they're the patterns that show up on every screen. Building them once removes a class of "should this empty state look like the other one?" decisions during feature work.

### 3. Navigation components (8 total) at `apps/web/src/components/nav/`

`MarketingHeader`, `MarketingFooter`, `AppSidebar`, `AppTopbar`, `OrganizationSwitcher`, `UserMenu`, `PlanBadge`, `AdminSidebar`. All use placeholder data — no auth, no DB. `AppSidebar` reads `usePathname()` for active-route highlighting; that's the only real behavior.

### 4. Design tokens

Wired Space Grotesk (display) + DM Sans (body) via `next/font/google` with CSS variables (`--font-display`, `--font-body`). Extended `tailwind.config.ts` with `fontFamily.display/body/mono`, `bg-mesh-fade`, `bg-grid-pattern`, `bg-grid-fade`, and a soft `pulse-soft` keyframe. Extended `globals.css` so all `h1-h6` use `font-display` by default.

Color system stays 100% on shadcn CSS variables. Light/dark switches by toggling `.dark` on `<html>`. No second palette to maintain.

### 5. `/dev/design-system` showcase page

Three tabs: **Foundations** (color swatches, typography, surfaces), **Primitives** (every shadcn + custom component), **Patterns** (PageHeader, SectionHeader, EmptyState, LoadingState, ErrorState).

Gated by `apps/web/src/app/dev/layout.tsx`:

```tsx
if (process.env.NODE_ENV !== 'development') notFound();
```

So `/dev/*` 404s in production builds. Index page at `/dev` lists all dev tools (design-system, sentry-test, feature-flags, auth-state, env) — most are still placeholders, but the surface exists.

Dialog/Dropdown demos live in `_demos.tsx` (`'use client'`) so the design-system page itself stays a server component.

---

## Decisions worth flagging

### Why route groups for marketing + auth, not for app or admin

`(marketing)` and `(auth)` are layout-only groupings — the URLs stay flat. App and admin are *path*-bearing (`/app/[orgSlug]/...`, `/admin/...`) because the org slug and the admin namespace are part of the URL contract. Don't conflate "shared layout" with "shared URL prefix."

### Why custom `EmptyState`/`ErrorState` instead of shadcn

Shadcn doesn't ship them, and rolling our own keeps the API consistent across the three states (Empty / Loading / Error all take the same `title / description / action` shape). Future-me will reach for these without thinking.

### Why `useSemanticElements` over `role="status"` in `LoadingState`

Biome's `useSemanticElements` lint flagged `<div role="status">`. Switched to `<output>` — it's the actual semantic element for live status. Biome was right; I'd have written the wrong thing without the lint nudge.

### Why all the placeholder data is hardcoded, not faked through a `lib/placeholders.ts`

Tempting to build a "fake org / fake user" module, but then deleting it during the auth wire-up becomes a search-and-replace job. Hardcoding inline makes the placeholder obvious at the call site — `<UserMenu />` renders "Honglei Ren" right there in the JSX. When auth lands, every placeholder shows up in a single grep.

### `exactOptionalPropertyTypes` bit us once

The shadcn `dropdown-menu.tsx` output has `<CheckboxPrimitive.Item checked={checked}>` where `checked: CheckedState | undefined`. Strict optional types reject that. Fix:

```tsx
{...(checked !== undefined && { checked })}
```

Conditional spread, not a default value. We're keeping `exactOptionalPropertyTypes: true` because the alternative is a long tail of "is this prop missing or is it explicitly undefined" bugs. The tax is exactly this pattern, in this exact spot, once.

---

## What we accept losing

- **No theme switcher in the UI yet.** Dark mode works (`.dark` on `<html>`), but there's no toggle component. Next sprint.
- **No real org/user/plan data.** All placeholder. The shells exist; the sources don't.
- **No mobile sidebar.** `AppSidebar` is a fixed 240px panel. Responsive collapse is a follow-up.
- **No keyboard shortcuts.** Topbar search input doesn't bind `⌘K` yet — it's a styled `<Input>`.

These are intentional. The bar for this pass was "every layout, every primitive, every nav component renders correctly in light + dark." Anything beyond that is feature work.

---

## Verification

| Check                       | Result                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| `biome check apps/web/src`  | 57 files clean                                                      |
| `tsc --noEmit`              | exit 0                                                              |
| `pnpm build`                | 24 routes compiled (21 placeholders + `/dev` + `/dev/design-system` + `_not-found`) |
| `/dev/design-system` First Load JS | 147 kB (5.66 kB page-specific)                              |
| Light + dark toggle         | `document.documentElement.classList.toggle('dark')` flips cleanly across all components |

---

## Files of interest

```
apps/web/src/
├── app/
│   ├── (auth)/layout.tsx              # centered card, mesh-fade bg
│   ├── (marketing)/layout.tsx         # header + footer
│   ├── admin/layout.tsx               # AdminSidebar + red-accent header
│   ├── app/[orgSlug]/layout.tsx       # AppSidebar + AppTopbar (async params)
│   ├── dev/
│   │   ├── layout.tsx                 # NODE_ENV gate (notFound in prod)
│   │   ├── page.tsx                   # dev tools index
│   │   └── design-system/
│   │       ├── page.tsx               # Foundations / Primitives / Patterns
│   │       └── _demos.tsx             # 'use client' Dialog + Dropdown demos
│   ├── onboarding/layout.tsx
│   ├── globals.css                    # h1-h6 → font-display, grid utilities
│   └── layout.tsx                     # next/font/google CSS vars
├── components/
│   ├── nav/                           # 8 components (4 server, 4 'use client')
│   └── ui/                            # 10 shadcn + 5 custom = 15 primitives
└── tailwind.config.ts                 # fontFamily, bg-mesh-fade, bg-grid-pattern
```

---

## What unlocks next

- **Auth wire-up** has a finished frame: `(auth)` layout exists, `/sign-in` and `/sign-up` are styled shells, just plug Clerk/NextAuth into the form bodies.
- **Org provisioning** has `/onboarding/create-organization` ready and `OrganizationSwitcher` knows how to render an org — connect them to a real source.
- **Feature work** doesn't have to invent layout, navigation, or primitives — every page can pull `PageHeader` + `EmptyState` + `LoadingState` + `ErrorState` and look consistent immediately.

The whole point of this pass: make the next sprint be about **logic**, not chrome.
