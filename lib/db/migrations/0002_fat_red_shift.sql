CREATE TABLE IF NOT EXISTS "engine"."external_articles_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(256) NOT NULL,
	"url" text NOT NULL,
	"article_text" text NOT NULL,
	"published_date" date,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."external_search_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(256) NOT NULL,
	"query" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"snippet" text,
	"search_ts" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine"."run_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ts" timestamp DEFAULT now() NOT NULL,
	"level" varchar(16) NOT NULL,
	"domain" varchar(256),
	"step" varchar(64),
	"message" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
ALTER TABLE "engine"."runs" ADD COLUMN "current_step" varchar(64);--> statement-breakpoint
ALTER TABLE "engine"."runs" ADD COLUMN "current_domain" varchar(256);--> statement-breakpoint
ALTER TABLE "engine"."runs" ADD COLUMN "substep_label" varchar(512);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engine"."run_log" ADD CONSTRAINT "run_log_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "engine"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
