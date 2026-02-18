# Expansion Signal Engine

CSV ingest, customer enrichment (external events), and LLM evaluation pipeline with run reporting and CSV export.

## Stack

- **Frontend**: Next.js (App Router), React
- **Backend**: Next.js API Routes
- **LLM**: Vercel AI Gateway (`@ai-sdk/gateway`)
- **DB**: PostgreSQL + Drizzle ORM (engine schema: customers, runs, prompts, etc.)
- **Deploy**: Vercel

## Setup

### 1. Environment

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` and `AI_GATEWAY_API_KEY` in `.env.local`.

### 2. Install and migrate

```bash
pnpm install
pnpm db:migrate
```

### 3. Run

**Option A — App only (logs via HTTP polling):**

```bash
pnpm dev
```

**Option B — App + log WebSocket server (real-time run logs):**

```bash
pnpm dev:all
```

This runs the Next.js app and the log WS server (`pnpm log-ws`) together. Set `NEXT_PUBLIC_LOG_WS_URL=ws://localhost:3001` in `.env.local` so the UI connects to the WS server.

**Option C — Two terminals:**

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm log-ws
```

Open http://localhost:3000.

### Optional: log WebSocket server (real-time run logs)

To stream run logs over WebSocket instead of HTTP polling, start the log server in a separate terminal:

```bash
pnpm log-ws
```

Set `NEXT_PUBLIC_LOG_WS_URL=ws://localhost:3001` (or your host/port) so the UI connects to it. If unset, the UI uses HTTP polling.

## Env vars

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key |
| `NEXT_PUBLIC_APP_URL` | Public app URL (optional) |
| `LOG_WS_PORT` | Port for the log WebSocket server (default 3001). Used when running `pnpm log-ws`. |
| `NEXT_PUBLIC_LOG_WS_URL` | WebSocket URL for run logs (e.g. `ws://localhost:3001`). If set, the UI streams logs over WSS; otherwise it falls back to HTTP polling. |
| `EXTERNAL_EVENTS_MAX_DOMAINS` | Max domains per run for external events enrichment (default 50). Optional. |
| `EXTERNAL_EVENTS_SEARCH_PROVIDER` | `newsapi` (default) or `google`. For Google: set `EXTERNAL_EVENTS_GOOGLE_CSE_KEY` and `EXTERNAL_EVENTS_GOOGLE_CSE_CX`. |

## Run cadence

The intended run cadence is **monthly**. Trigger runs manually or via an external scheduler (e.g. cron); the app does not include a built-in scheduler.

## Project structure

- `app/page.tsx` — Renders Expansion Engine UI
- `components/expansion-engine-ui.tsx` — Main UI: run config, CSV ingest, customers & enrichment, evaluation, process reporting, run log, results
- `app/api/engine/` — Ingest, customers, prompts, enrich, evaluate, run (progress, resume, export, log)
- `lib/engine/` — Run pipeline, LLM evaluation, context snapshot, atomic signals, lift stats, external events enrichment
- `lib/prompts/load-prompts.ts` — List/read prompt files from disk
- `content/prompts/` — Event and evaluation prompt `.md` files
- `scripts/ws-log-server.ts` — WebSocket server for streaming run logs (`pnpm log-ws`)
- `scripts/verify-enrichment-pipeline.ts` — Verifies enrichment query counts and pipeline order (`pnpm verify-enrichment`)
