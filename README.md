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

Use two terminals. Run logs stream via WebSocket only; set `NEXT_PUBLIC_LOG_WS_URL` in `.env.local` (required).

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm log-ws
```

Open http://localhost:3000.

For debug mode (raw log format with timestamps and JSON): run `pnpm dev:debug` in Terminal 1 instead of `pnpm dev`.

## Env vars

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key |
| `NEXT_PUBLIC_APP_URL` | Public app URL (optional) |
| `LOG_WS_PORT` | Port for the log WebSocket server (default 3001). Used when running `pnpm log-ws`. |
| `NEXT_PUBLIC_LOG_WS_URL` | **Required.** WebSocket URL for run logs (e.g. `ws://localhost:3001`). Run `pnpm log-ws` in a separate terminal. |
| `EXTERNAL_EVENTS_MAX_DOMAINS` | Max domains per run for external events enrichment (default 50). Optional. |
| `EXTERNAL_EVENTS_SEARCH_PROVIDER` | `newsapi` (default) or `google`. For News API: set `EXTERNAL_EVENTS_NEWS_API_KEY` from [newsapi.org](https://newsapi.org) (free tier: 100 requests/day). For Google: set `EXTERNAL_EVENTS_GOOGLE_CSE_KEY` and `EXTERNAL_EVENTS_GOOGLE_CSE_CX`. |

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
