# AI Provider Outage Runbook

## Symptoms

- `/api/ai/chat` returns 5xx responses, times out, or drops the stream before any assistant text appears.
- Users see the chat UI stuck in a loading state, or a streamed answer stops midway.
- Axiom shows bursts of `provider_unavailable`, `provider_timeout`, `quota.exceeded`, or `rate_limit.hit` events.
- Cost or token usage spikes faster than expected, especially on one org or one prompt path.

## Triage

1. Check the provider status page first: [status.openai.com](https://status.openai.com).
2. Check whether the failure is provider-side or app-side.

```apl
['ai-workspace-lab']
| where _time > ago(1h)
| where module == 'api/ai-chat'
| where level in ('error', 'warn')
| sort by _time desc
```

3. Look for quota or rate-limit failures versus actual provider errors.

```apl
['ai-workspace-lab']
| where _time > ago(24h)
| where ['message'] in ('quota.exceeded', 'rate_limit.hit', 'ai.chat.failed', 'ai.chat.provider_unavailable')
| summarize count() by ['message'], orgId
| sort by count_ desc
```

4. If the route is returning errors but the provider is healthy, check auth, membership, entitlement, and rate-limit logs before assuming an outage.
5. If the provider is healthy and the app is healthy, the issue is likely a single-org quota or entitlement problem.

## If OpenAI is down

1. Leave the app up. Do not break the whole product because one provider is sick.
2. Confirm the failure mode in Axiom and in the OpenAI status page.
3. Keep the AI route returning a typed unavailable error instead of retrying forever.
4. If the code path already supports it, switch the provider factory to the Anthropic fallback.

## Cost spike or kill switch

1. Turn off the AI chat feature flag for everyone.
2. If the spike is isolated to one organization, lower or revoke that org’s AI entitlement or quota.
3. Verify that new requests stop before the provider call.

```apl
['ai-workspace-lab']
| where _time > ago(6h)
| where ['message'] == 'usage.recorded'
| where featureKey == 'ai_messages'
| summarize total_tokens = sum(totalTokens), total_cost_micro_usd = sum(costMicroUsd) by orgId, bin(_time, 1h)
| sort by total_cost_micro_usd desc
```

4. If the cost spike is broad, keep the kill switch on until the prompt path is reviewed.

## Anthropic emergency fallback

Use this only when OpenAI is materially unavailable and the chat surface still needs to serve traffic.

1. Confirm the Anthropic secret is available in production.
2. Swap the default provider factory in `packages/ai` from OpenAI to Anthropic.
3. Update the default model mapping to the Anthropic model approved in ADR 0001.
4. Redeploy.
5. Smoke test:
   - streaming response starts
   - usage is recorded once
   - quota and rate limits still block before provider calls
   - `onFinish` failure logging still includes org/session/message context

## When to escalate

- The outage lasts long enough that the feature flag has to stay off for more than a short incident window.
- Cost spikes continue after the kill switch is enabled.
- The fallback provider also starts failing.
- Axiom shows provider errors but the app has no matching logs, which usually means the AI route is failing before the provider boundary and needs engineering attention.
