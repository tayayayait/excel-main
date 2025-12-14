# Deployment & Operations Guide

## Environment Secrets

- `CHATGPT_API_KEY`: OpenAI ChatGPT key (used by `gpt-4o-mini`). Store it in your vault, rotate regularly, and update `.env.local`/CI secrets (see `.env.sample`).
- `API_TOKEN`: Bearer token accepted by the claim server (mock token for local dev). Keep private and rotate when teams change.
- `MODEL_PROVIDER` / `INTERNAL_MODEL_API_URL`: Switch between ChatGPT and the internal ML service without code changes. Document whichever provider is live in this repo's release notes.

After updating secrets:

```bash
npm run build
```

to ensure the bundle picks up the new value (Vite embeds `process.env.*` at build time).

## ChatGPT Key Rotation

1. Request a new ChatGPT key from the platform team or OpenAI portal.
2. Update `.env.local` (or CI secrets) with the new `CHATGPT_API_KEY`.
3. Trigger `npm run qa:evaluate` and `npm run model:log` against a known fixture to sanity-check classification continuity.
4. Redeploy the web app so the new key gets baked in (the UI shows `AI Analysis` output if ChatGPT is reachable).

## Server Sync Monitoring

- Mock server logs (when running `npm run mock:server`) are written to console; in prod you should tail the server logs for `claims.uploaded`.
- The UI displays server status above the filters; check the SSE endpoint if the indicator is stuck on “Syncing”.
- Use `npm run model:log` to track classification accuracy over time; the log file `logs/model-performance.log` is append-only and useful for post-mortems.
  - `cleanData()` now returns both `claims` and `stats`; use the stats to monitor invalid rows (missing 날짜/차종/설명) before uploading.
  - The mock server and spec assume `updatedAt` timestamps for every claim; uploads must preserve source IDs so QA accuracy calculations match the ground truth.

## Deployment Checklist

1. `npm run lint` / `npm run test` / `npm run build` pass locally or in CI.
2. Secrets (`.env.local` or vault) include `CHATGPT_API_KEY`, `API_BASE_URL`, `API_TOKEN`, optional `INTERNAL_MODEL_API_URL`.
3. If switching from mock to real server, update `API_BASE_URL` + `API_TOKEN` and confirm SSE connectivity via `/api/notifications/stream`.
4. After deployment, upload a small CSV, verify AI enrichment, and check that `Classification QA Review` lists the same number of candidate rows as before (end-to-end validation).
