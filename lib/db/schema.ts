import type { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── ChatMessage ────────────────────────────────────────────────────
// History keyed by sessionId (cookie). No user/course/unit.
export const chatMessage = pgTable("ChatMessage", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  agentType: varchar("agentType", { length: 32 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type ChatMessage = InferSelectModel<typeof chatMessage>;
