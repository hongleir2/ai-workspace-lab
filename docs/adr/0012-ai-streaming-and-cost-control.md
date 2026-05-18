# 0012 — AI Streaming and Cost Control

## Status

Accepted

## Context

The product needs a streaming AI chat experience that feels immediate, supports quota enforcement before the model call, and records token usage and cost without double-counting. The first shipped AI path is the highest-risk place to get the provider shape wrong because every request is both user-facing and directly billable.

ADR 0001 names Anthropic Claude as the stack default, but the first rollout here uses OpenAI. That is not a change in architecture direction; it is a rollout choice. The provider boundary already lives in `packages/ai`, so we can ship the first version with OpenAI, keep the route code provider-agnostic, and still preserve a clean path back to Anthropic later.

## Decision

### 1. Use the Vercel AI SDK streaming path

- The AI chat route uses `streamText` from the Vercel AI SDK for streamed responses.
- OpenAI is wired through `@ai-sdk/openai`.
- App routes do not import provider SDKs directly; they call `packages/ai` exports only.

### 2. Keep provider-specific logic inside `packages/ai`

- `packages/ai` owns the provider factory, model selection, prompt/version wiring, and token/cost helpers.
- The package exports a stable chat interface for the web app and any future server consumer.
- Swapping providers should be a package-level change, not a route rewrite.

### 3. Record cost in micro-USD

- AI cost is recorded as `micro-USD` in integer fields, not floats.
- Token usage and provider pricing are converted to `cost_micro_usd` at the package boundary.
- This keeps cost math deterministic and safe for aggregation into `usage_events`, `usage_counters`, and any later cost dashboard.

### 4. Enforce the security and cost gate in order

Every AI request follows this server-side order before the provider call:

1. `requireUser()`
2. `requireOrganization()`
3. `requireMembership()`
4. `checkEntitlement("ai_messages")`
5. `checkQuota("ai_messages")`
6. `checkRateLimit("/api/ai/chat")`
7. `resolveRagScope()` and verify every retrieved chunk belongs to the organization
8. Call the provider

This order is not optional. The provider is the last step, never the first.

### 5. Use plan-specific rate limits

- Free and Pro use different AI limits, with the plan limits defined server-side.
- The default launch shape is the same one already reflected in the roadmap: `free.ai_messages = 10/day` and `pro.ai_messages = 500/billing_period`.
- The user sees a typed quota or rate-limit error instead of a generic failure when the gate blocks the call.

### 6. Write usage exactly once

- Every AI response writes usage with a stable idempotency key.
- `usage_events` is the source of truth; `usage_counters` are derived from it.
- A retry, replay, or duplicate completion path must not produce a second usage row for the same logical request.
- If the provider returns partial usage for an aborted or failed stream, that usage is still recorded once.

## Alternatives considered

- **Anthropic first, per ADR 0001** — sensible as a stack default, but the first chat rollout needs the fastest path to a working streaming experience with provider abstraction already in place. OpenAI is the narrower rollout choice, not a new architectural commitment.
- **Direct OpenAI SDK** — rejected because it would split the streaming implementation from the repo’s provider abstraction and make a later switch back to Anthropic more expensive than it needs to be.

## Consequences

- Provider outages now surface as typed AI errors and degraded chat states, not silent hangs.
- `onFinish` failures are operationally important. If usage persistence or message finalization fails after the model has streamed, the failure must be logged with org/session/message context and treated as retry-worthy.
- Aborted streams can still incur provider cost even when the browser disconnects before the final payload arrives. Cost estimates for those requests are lower bounds until provider-reported usage is available.
- Because provider selection lives in `packages/ai`, switching to Anthropic later is a bounded change: update the provider factory and model mapping, switch the env secret, smoke test `streamText`, and re-run the AI chat verification path. No schema change should be required.

## Follow-up work

- Add the AI usage and cost dashboard once volume justifies the extra reporting surface.
- Keep the provider swap path documented in the AI provider outage runbook.
