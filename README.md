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

```bash
pnpm dev
```

Open http://localhost:3000.

## Env vars

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key |
| `NEXT_PUBLIC_APP_URL` | Public app URL (optional) |

## Project structure

- `app/page.tsx` — Renders Expansion Engine UI
- `components/expansion-engine-ui.tsx` — Main UI: run config, CSV ingest, customers & enrichment, evaluation, process reporting, run log, results
- `app/api/engine/` — Ingest, customers, prompts, enrich, evaluate, run (progress, resume, export, log)
- `lib/engine/` — Run pipeline, LLM evaluation, context snapshot, atomic signals, lift stats, external events enrichment
- `lib/prompts/load-prompts.ts` — List/read prompt files from disk
- `content/prompts/` — Event and evaluation prompt `.md` files
