CREATE TABLE IF NOT EXISTS "ChatMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" varchar(64) NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"agentType" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
