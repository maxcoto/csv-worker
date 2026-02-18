ALTER TABLE "engine"."customers" ADD COLUMN IF NOT EXISTS "last_enriched_at" timestamp;--> statement-breakpoint
ALTER TABLE "engine"."customers" ADD COLUMN IF NOT EXISTS "last_enrichment_run_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "engine"."customers" ADD CONSTRAINT "customers_last_enrichment_run_id_runs_id_fk" FOREIGN KEY ("last_enrichment_run_id") REFERENCES "engine"."runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
