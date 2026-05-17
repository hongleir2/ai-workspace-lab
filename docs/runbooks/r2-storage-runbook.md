# R2 Object Storage — Runbook

Operational reference for Cloudflare R2 (the object storage layer for document uploads).

---

## Setup (first time)

### 1. Create a bucket

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Storage & Databases → R2 → Overview**
2. **Create bucket** — name e.g. `ai-workspace-lab-uploads`
3. Note your **Account ID** from the right sidebar

### 2. Generate an API token

1. R2 overview → **Manage R2 API Tokens → Create API token**
2. Permission: **Object Read & Write**, scope to your specific bucket
3. Copy **Access Key ID** and **Secret Access Key** immediately (secret shown once)

### 3. Environment variables

| Variable | Where to get it |
|---|---|
| `R2_ACCOUNT_ID` | R2 overview page, right sidebar |
| `R2_ACCESS_KEY_ID` | API token creation step |
| `R2_SECRET_ACCESS_KEY` | API token creation step |
| `R2_BUCKET` | The bucket name you chose |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Optional — public CDN domain if bucket is exposed publicly |

Set `STORAGE_PROVIDER=r2` to activate the R2 provider.

### 4. CORS policy (required for browser direct-upload)

Document uploads use a presigned URL — the browser PUTs the file directly to R2. Without CORS the PUT will be blocked.

In R2 dashboard → your bucket → **Settings → CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["https://your-production-domain.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

For local dev add `http://localhost:3000` to `AllowedOrigins`.

---

## Diagnosing upload failures

### Symptom: browser console shows CORS error on PUT

**Cause:** CORS policy missing or `AllowedOrigins` doesn't match the app's origin exactly.

**Fix:** Update the CORS policy on the bucket. Confirm the origin includes protocol + port (`http://localhost:3000`, not `localhost:3000`).

### Symptom: `POST /api/orgs/[orgSlug]/documents` returns 500

**Diagnose:**
```bash
# Check server logs for the actual StorageError message
# Common: "R2 credentials not configured"
```

**Fix:** Confirm all four env vars are set (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) and `STORAGE_PROVIDER=r2`.

### Symptom: presigned URL works but PUT returns 403

**Cause:** API token lacks write permission on the bucket, or the token was scoped to a different bucket.

**Fix:** Regenerate the API token with **Object Read & Write** permission scoped to the correct bucket.

### Symptom: presigned URL expires before the client PUT completes

The presigned URL TTL is set in `packages/storage/src/providers/r2.ts`. Default is 15 minutes — sufficient for files up to 5 MB on any reasonable connection. If users upload from very slow connections, increase the TTL.

---

## Key rotation

1. In the R2 dashboard, create a **new** API token with the same permissions
2. Update `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Vercel (all environments)
3. Redeploy (or wait for the next deploy to pick up the new vars)
4. Delete the old API token in the R2 dashboard
5. Verify uploads still work end-to-end before closing the rotation

---

## Storage costs (reference)

Cloudflare R2 free tier (as of 2024):
- **10 GB storage / month** free
- **1 million Class A operations** (writes) / month free
- **10 million Class B operations** (reads) / month free
- **Zero egress fees** (files served via Cloudflare CDN)

At 5 MB max per document, the free tier covers ~2,000 uploads per month before storage charges apply.
