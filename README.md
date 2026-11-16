# CART3R OmniRoute

Online-only AI gateway starter for GitHub. Routes chat requests across multiple OpenAI-compatible providers, switches before configured quota thresholds, and falls back when a provider errors or rate-limits.

## What this starter does

- Automatic priority-based provider routing.
- Per-provider daily and monthly request budgets.
- Default switch threshold at 80%; hard stop at 100%.
- Global daily/monthly request caps.
- Failover when a provider returns an error, rate limit, or timeout.
- Health and usage status endpoint.
- API-key protection for CART3R clients.
- GitHub Actions CI and Docker support.

## Important quota note

Many providers do not expose an exact live percentage of account quota through their APIs. This starter therefore tracks **requests made through this gateway** against limits you configure. It does not read or guarantee the provider's true account balance. Set each provider's limits conservatively, and check its own dashboard for actual token/credit usage. The default 80% switch point leaves a buffer; 100% is the hard local cap.

This is not a way to bypass provider limits, free-tier restrictions, or terms. Each provider must be used through an authorized API/account. If a provider does not offer an API or does not permit the intended use, do not add it as a backend provider.

## 1. Setup

Requirements: Node.js 22+.

```bash
npm install
cp .env.example .env
cp config/providers.example.json config/providers.json
```

Edit `.env` and set a long random `CART3R_API_KEY`. Add provider API keys as environment variables. Example:

```env
PROVIDER_A_API_KEY=...
PROVIDER_B_API_KEY=...
PROVIDER_C_API_KEY=...
```

Edit `config/providers.json` with providers/models you are authorized to use. All configured endpoints must implement the OpenAI-compatible `/chat/completions` API. Disable any provider you have not configured.

```bash
npm run dev
```

## 2. Test the API

Health:

```bash
curl http://localhost:8787/health
```

Chat:

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer YOUR_CART3R_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Explain recursion simply."}]}'
```

Usage status:

```bash
curl http://localhost:8787/v1/status \
  -H "Authorization: Bearer YOUR_CART3R_API_KEY"
```

## 3. Quota behaviour

- A provider is considered eligible while its locally tracked daily and monthly usage is below `PROVIDER_SWITCH_AT_PERCENT`.
- Default switch threshold: 80%.
- The hard local provider cap is 100% of the configured request budget.
- If the primary provider fails, the router tries the next eligible provider in priority order.
- The global daily/monthly limits stop requests across all providers.
- Counters are stored in `data/usage.json`; back up this file if you need usage history.

**Do not set huge budgets just to make the status look like 100%.** Configure realistic budgets based on the actual provider account limits and your intended user allowance. Request counts are not the same as token credits.

## 4. GitHub deployment

GitHub stores the source and runs CI. It does not host this always-on backend by itself. Deploy the backend to a server/container host that supports Node.js or Docker, then set secrets in that host's environment settings.

Never commit `.env`, API keys, user tokens, or `data/usage.json`. The included GitHub Actions workflow only runs type checks, tests, and build.

## 5. Add a provider

Add a provider object to `config/providers.json`, assign a unique `id`, set its `baseUrl`, model, `apiKeyEnv`, limits and priority, then add the matching secret to the backend host. Restart/redeploy the service.

## Current limitations / production hardening

This is a functional starter, not a finished public multi-tenant service. Before exposing it to the internet:
- Replace the single shared API key with user accounts, per-user quotas, and secure token storage.
- Use Redis or a transactional database for atomic usage accounting across multiple server instances.
- Add streaming, provider-specific quota adapters, retries with backoff, circuit-breaker cooldowns, and request idempotency.
- Add moderation and age-appropriate safety controls before connecting public sources or user-facing clients.
- Add provider-specific request formats where OpenAI compatibility is incomplete.
- Configure HTTPS, rate limiting, logs with personal data redaction, and monitoring.

## Project layout

```text
.
├── .github/workflows/ci.yml
├── config/providers.example.json
├── src/
│   ├── config.ts
│   ├── router.ts
│   ├── server.ts
│   ├── types.ts
│   └── usage.ts
├── .env.example
├── Dockerfile
└── README.md
```
