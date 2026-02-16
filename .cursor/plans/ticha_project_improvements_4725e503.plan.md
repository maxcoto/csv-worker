---
name: Ticha Project Improvements
overview: "A prioritized set of improvements for Ticha (math exam prep with an AI professor): reliability and correctness fixes, testing, security, code structure, UX/a11y, and optional product/ops enhancements."
todos: []
isProject: false
---

# Ticha — Proposed Project Improvements

Based on a full read of the README and codebase ([app/](app/), [lib/](lib/), [components/](components/), [scripts/](scripts/)), the following improvements are proposed, grouped by impact and effort.

---

## 1. Correctness and reliability

### 1.1 Await refusal message persistence (bug)

In [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts), `createRefusalResponse` calls `saveChatMessage(...)` without `await`. If the write fails or is slow, the refusal may not appear in chat history.

- **Change:** `await saveChatMessage({...})` inside `createRefusalResponse` so the refusal is persisted before returning the response.

### 1.2 Explicit insert fields in `upsertStudentState`

In [lib/db/queries.ts](lib/db/queries.ts), the insert branch of `upsertStudentState` does not set `currentSimulationId` or `simulationQuestionIndex`. The schema defaults are correct, but being explicit avoids drift if defaults change.

- **Change:** Add `currentSimulationId: data.currentSimulationId ?? null` and `simulationQuestionIndex: data.simulationQuestionIndex ?? 0` to the insert `values` in `upsertStudentState`.

---

## 2. Testing

There are **no tests** in the repo. Adding tests will protect refactors and the critical learning flow.

- **Unit tests (recommended first):**
  - **Orchestrator:** Phase transitions (e.g. greeting → learning, learning → examining on “estoy listo”, examining → evaluating → next topic when required questions passed). Mock DB and LLM.
  - **Evaluator:** JSON parsing and fallback when the model returns invalid or partial JSON ([lib/ai/agents/evaluator.ts](lib/ai/agents/evaluator.ts) lines 69–110).
  - **Scope check:** `checkScope` in orchestrator — messages under 60 chars or matching pass patterns return true without LLM; optionally one LLM test with mocked `generateText`.
  - **API routes:** Auth (missing/invalid token returns 401), validation (empty or oversized message returns 400) for [app/api/chat/route.ts](app/api/chat/route.ts).
- **E2E (optional but valuable):** One critical path: open magic link → greeting → send a message in learning → (optionally) trigger examination and one evaluation. Use Playwright (already in devDependencies). Can use a test token and mocked or small model to keep runs fast.

---

## 3. Security and production hardening

- **Magic link endpoint:** When `ADMIN_API_KEY` is unset, [app/api/magic-link/route.ts](app/api/magic-link/route.ts) allows unauthenticated creation of links. README already says “optional”. **Recommendation:** In production, require `ADMIN_API_KEY` (return 503 or 401 if missing) so the endpoint is never accidentally left open.
- **Rate limiting:** Add rate limiting to `POST /api/chat` (e.g. by token or IP) to cap cost and abuse. Implement via Vercel middleware, Upstash Redis, or a simple in-memory store for single-instance deploys.

---

## 4. Code structure and maintainability

- **Orchestrator size:** [lib/ai/orchestrator.ts](lib/ai/orchestrator.ts) is ~570 lines and holds all phase handlers. Consider:
  - Extracting phase handlers into separate modules (e.g. `orchestrator/greeting.ts`, `orchestrator/learning.ts`, …) and calling them from a thin `orchestrator.ts`, or
  - Moving helpers (`generateNextQuestion`, `findLastExaminerQuestion`, `loadChatHistory`, `createRefusalResponse`, `checkScope`, `detectExamRequest`) into something like `orchestrator/helpers.ts` to shrink the main file and improve testability.
- **Shared types:** `DisplayMessage` (and related evaluation result shape) is duplicated in [components/learning-interface.tsx](components/learning-interface.tsx) and [components/chat-panel.tsx](components/chat-panel.tsx). Move to a shared module (e.g. `types/chat.ts` or `components/chat-types.ts`) and import in both.
- **Logging:** The Ultracite rule disallows `console`. API routes and the evaluator use `console.error`. Replace with a small logger (e.g. a `lib/logger.ts` that wraps one or two methods and can be swapped for a proper logger later) so production logging is consistent and rule-compliant.

---

## 5. API and streaming

- **Stream protocol:** The chat route uses a custom stream format (`0:${JSON.stringify(chunk)}\n`). If the rest of the stack supports it, consider using the Vercel AI SDK’s standard streaming protocol and `useChat` on the client so parsing and handling of tool calls or multi-part responses are consistent and less custom.
- **Progress polling:** The client polls `/api/progress` after each interaction. Optional improvement: support `ETag` / `If-None-Match` on `GET /api/progress` to return 304 when nothing changed and reduce payload.

---

## 6. UX and accessibility

- **Evaluating phase:** When `currentPhase === "evaluating"`, the UI could explicitly disable the input and show a short “Calificando…” message to avoid duplicate submissions and clarify state.
- **Error recovery:** On stream or network errors in [components/learning-interface.tsx](components/learning-interface.tsx), show a clear message and a “Reintentar” (or similar) action instead of only a toast.
- **Root and error pages:** Ensure a single logical `h1` and, if needed, `aria-live` for dynamic status (e.g. “Cargando…”, “Calificando…”). The app already uses `lang="es"` and SVG titles where used.

---

## 7. Product and content

- **Simulation grading:** Simulations currently grade only the last answer and use a single combined rubric ([lib/ai/orchestrator.ts](lib/ai/orchestrator.ts) around 469–493). For a more faithful “exam” experience, consider storing and grading each answer, then computing an overall score (e.g. average or weighted).
- **Token lifecycle:** No “resend magic link” or “extend link” flow. A simple “Mi enlace expiró” link that asks for email (or student id) and calls an admin endpoint to issue a new link could improve support.
- **Content cache:** [lib/ai/content-loader.ts](lib/ai/content-loader.ts) caches topic content in process memory and never invalidates. This is fine for file-based, rarely changed content; document that editing content requires a restart (or add an optional cache invalidation path if you ever support hot-reload of content).

---

## 8. Documentation and environment

- **README:** Add a short “Troubleshooting” section: e.g. “Stream error” / “Failed to save streamed message” (check DB and LLM connectivity), and point to [.env.example](.env.example) for required variables (`DATABASE_URL`, `AI_GATEWAY_API_KEY`, etc.).
- **.env.example:** `MAGIC_LINK_SECRET` is listed but auth uses DB-backed tokens (nanoid) only. Remove it or add a comment that it’s reserved for future JWT use so operators don’t assume it’s required for current magic links.

---

## Suggested order of implementation


| Priority | Item                                                                      | Effort     |
| -------- | ------------------------------------------------------------------------- | ---------- |
| 1        | Await `saveChatMessage` in `createRefusalResponse`                        | Low        |
| 2        | Add unit tests for evaluator parsing and chat API auth/validation         | Medium     |
| 3        | Require `ADMIN_API_KEY` in production for magic-link                      | Low        |
| 4        | Extract shared `DisplayMessage` type; optional orchestrator split/helpers | Low–Medium |
| 5        | Replace `console.error` with a small logger                               | Low        |
| 6        | Rate limiting on `/api/chat`                                              | Medium     |
| 7        | UX: evaluating state + error recovery in learning UI                      | Low–Medium |
| 8        | README troubleshooting + .env.example clarification                       | Low        |


No changes to the core flow (three agents, state machine, content loading) are required for correctness; the above improvements focus on robustness, security, maintainability, and clarity.