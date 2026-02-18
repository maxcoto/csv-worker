/**
 * Standalone WebSocket server for streaming run log entries.
 * Connect with ?runId=<uuid>. Server polls getRunLogEntries every 1.5s and sends new entries.
 *
 * Requires DATABASE_URL (e.g. in .env or .env.local). Port: LOG_WS_PORT (default 3001).
 *
 * Usage: pnpm log-ws   (or npx tsx scripts/ws-log-server.ts)
 */

import { config } from "dotenv";
config({ path: ".env.local", override: false });
config({ path: ".env", override: false });

import { WebSocketServer } from "ws";
import { getRunLogEntries } from "../lib/engine/run-log";

const PORT = Number.parseInt(
  process.env.LOG_WS_PORT ?? "3001",
  10
);
const POLL_MS = 1500;

const wss = new WebSocketServer({ port: PORT });

type ClientState = {
  runId: string;
  lastSeq: number;
};

wss.on("connection", (ws, req) => {
  const url = req.url ?? "";
  const runId =
    new URL(url, `http://localhost`).searchParams.get("runId")?.trim() ?? "";
  if (!runId) {
    ws.close(4000, "runId required");
    return;
  }
  const state: ClientState = { runId, lastSeq: 0 };

  const poll = async () => {
    if (ws.readyState !== 1) {
      return;
    }
    try {
      const { entries, hasMore } = await getRunLogEntries(state.runId, {
        since: state.lastSeq,
        limit: 500,
      });
      if (entries.length > 0) {
        const maxSeq = Math.max(
          ...entries.map((e) => e.seq),
          state.lastSeq
        );
        state.lastSeq = maxSeq;
        ws.send(
          JSON.stringify({
            type: "log",
            entries,
            hasMore,
          })
        );
      }
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          })
        );
      }
    }
  };

  const interval = setInterval(poll, POLL_MS);
  void poll();

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { lastSeq?: number };
      if (typeof msg.lastSeq === "number" && msg.lastSeq >= 0) {
        state.lastSeq = msg.lastSeq;
      }
    } catch {
      // ignore invalid JSON
    }
  });

  ws.on("close", () => {
    clearInterval(interval);
  });
});

console.log(`Log WebSocket server listening on port ${PORT}. Connect with ?runId=<runId>`);
