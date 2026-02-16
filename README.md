# Data Chat — CSV prompts + multi-agent chatbot

Chat app that combines **conversational AI** with **data actions**: upload a CSV or spreadsheet, pick a prompt from the filesystem, and get back structured results you can copy or download.

## What it does

- **Chat**: Multi-agent assistant (Default, Analyst, Writer). Session is tracked by cookie; no login. History is stored per session in PostgreSQL.
- **Data flow**: Upload a CSV or text file, choose an action from a set of **.md prompt files** (e.g. Summarize, Classify, Extract), type instructions in the text box, and send. The LLM runs with the selected prompt + your message + the file content and returns a result (typically CSV). You can **copy** the result or **download it as CSV**.
- **Prompts on disk**: Actions are defined in `content/prompts/*.md`. Add or edit markdown files there; the app lists them in the UI and uses their content as the system prompt when you send a message with a file attached.

## Stack

- **Frontend**: Next.js (App Router), React
- **Backend**: Next.js API Routes
- **LLM**: Vercel AI Gateway (`@ai-sdk/gateway`)
- **DB**: PostgreSQL + Drizzle ORM (ChatMessage table keyed by session cookie)
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

Open http://localhost:3000. The first request sets a session cookie; chat history is stored per session.

## Env vars

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API key |
| `NEXT_PUBLIC_APP_URL` | Public app URL (optional) |

## Using the app

1. **Chat only**: Choose an agent (Default / Analyst / Writer), type a message, send. Replies stream in and history is saved.
2. **Data action**: Click **Upload CSV / file** and select a CSV or text file (max 5 MB). Pick a **Prompt** (e.g. Summarize, Classify, Extract). Type what you want (e.g. “Add a category column”). Send. The response is shown as an assistant message with **Copy** and **Download CSV** under it.

## Adding data prompts

Add a new `.md` file under `content/prompts/`. The filename (without `.md`) becomes the prompt id; the UI shows a humanized name (e.g. `my-action.md` → “My action”). The file content is used as the **system prompt** when the user sends a message with a file and that prompt selected.

Example `content/prompts/translate.md`:

```md
You are a data assistant. The user will provide a CSV and a request.
Your task: translate or localize the data according to the user's instructions.
Respond with a valid CSV. Output only the CSV, no other text.
```

## Project structure

- `app/page.tsx` — Main UI (Sidebar + ChatPanel, file upload, prompt/agent selectors)
- `app/api/chat/route.ts` — POST chat; optional `attachment` + `promptId` for data flow (returns JSON `{ result }`)
- `app/api/chat/history/route.ts` — GET history (session from cookie)
- `app/api/prompts/route.ts` — GET list of prompts from `content/prompts/*.md`
- `content/prompts/*.md` — Data action prompts (Summarize, Classify, Extract, etc.)
- `lib/ai/orchestrator.ts` — Chat flow: history + default agent (streaming)
- `lib/ai/run-data-prompt.ts` — Data flow: .md prompt + message + file content → single result
- `lib/ai/agents/default.ts` — Streaming agent (prompt from agentId)
- `lib/ai/prompts.ts` — In-code system prompts for chat agents
- `lib/prompts/load-prompts.ts` — List/read prompt files from disk
- `lib/auth/session.ts` — Cookie helpers (session_id)
- `lib/db/schema.ts` — ChatMessage (sessionId, role, content, agentType)

## Adding chat agents

1. Add a system prompt in `lib/ai/prompts.ts` (`AGENT_PROMPTS` and `AGENT_IDS`).
2. Add the agent id to the selector in `components/chat-interface.tsx` (`AGENT_IDS` / `AGENT_LABELS`).
