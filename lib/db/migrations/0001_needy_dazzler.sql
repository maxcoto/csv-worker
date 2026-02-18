CREATE SCHEMA IF NOT EXISTS "engine";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ChatMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sessionId" varchar(64) NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"agentType" varchar(32),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."account_context_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"domain" varchar(256) NOT NULL,
	"evaluation_month" date NOT NULL,
	"data_quality_score" double precision,
	"context_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."atomic_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(256) NOT NULL,
	"month" date NOT NULL,
	"signal_type" varchar(64) NOT NULL,
	"signal_value" double precision,
	"signal_score" double precision,
	"signal_timestamp" timestamp,
	"signal_version" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar(256) NOT NULL,
	"account_name" varchar(512),
	"website" text,
	"domain" varchar(256) NOT NULL,
	"arr" double precision,
	"renewal_date" date,
	"segment" varchar(128),
	"status" varchar(64),
	"licensed_seats" integer,
	"extra" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."external_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(256) NOT NULL,
	"event_type" varchar(128),
	"event_ts" timestamp,
	"source" varchar(256),
	"source_url" text,
	"payload_json" jsonb,
	"confidence" double precision,
	"extra" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."lift_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_type" varchar(64) NOT NULL,
	"expansion_rate" double precision,
	"non_expansion_rate" double precision,
	"lift_ratio" double precision,
	"sample_size" integer,
	"lift_stats_version" varchar(32) NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."llm_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"domain" varchar(256) NOT NULL,
	"prompt_version" varchar(32),
	"signal_version" varchar(32) NOT NULL,
	"lift_stats_version" varchar(32) NOT NULL,
	"engine_version" varchar(32) NOT NULL,
	"model_name" varchar(128) NOT NULL,
	"expansion_score" integer,
	"risk_score" integer,
	"recommended_motion" varchar(32),
	"why_now" text,
	"reasoning" text,
	"evidence_used" jsonb,
	"raw_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar(256) NOT NULL,
	"opportunity_id" varchar(256),
	"type" varchar(64),
	"stage" varchar(64),
	"created_date" date,
	"close_date" date,
	"amount" double precision,
	"extra" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"version" varchar(32) NOT NULL,
	"system_prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_month" date NOT NULL,
	"prompt_id" uuid,
	"prompt_version" varchar(32),
	"signal_version" varchar(32) NOT NULL,
	"lift_stats_version" varchar(32) NOT NULL,
	"engine_version" varchar(32) NOT NULL,
	"status" varchar(32) NOT NULL,
	"processed_count" integer DEFAULT 0,
	"total_customers" integer,
	"last_processed_index" integer,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."telemetry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(256) NOT NULL,
	"month" date NOT NULL,
	"active_users_30d" integer,
	"licensed_seats" integer,
	"feature_adoption_score" double precision,
	"extra" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engine"."account_context_snapshots" ADD CONSTRAINT "account_context_snapshots_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "engine"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engine"."llm_evaluations" ADD CONSTRAINT "llm_evaluations_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "engine"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engine"."runs" ADD CONSTRAINT "runs_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "engine"."prompts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "atomic_signals_domain_month_type_idx" ON "engine"."atomic_signals" USING btree ("domain","month","signal_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_domain_idx" ON "engine"."customers" USING btree ("domain");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "telemetry_domain_month_idx" ON "engine"."telemetry" USING btree ("domain","month");