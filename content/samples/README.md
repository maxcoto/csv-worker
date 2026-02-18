# Sample CSV data for Expansion Signal Engine

Use these four CSV files to test the engine without real data.

1. **customers.csv** – 7 sample customers (domains: acme.com, globex.com, initech.com, umbrellacorp.com, wayne.com, stark.com, oscorp.com).
2. **opportunities.csv** – One opportunity per customer, linked by `account_id`.
3. **external_events.csv** – One external event per domain (funding, exec hire/departure, partnership, product launch).
4. **telemetry.csv** – Usage per domain for two months (2024-12 and 2025-01) so the evaluation month resolver has data.

**How to use:** In the Expansion Engine UI, upload each file in the corresponding CSV input, then click "Upload & Ingest". You can then run enrichment and evaluation.
