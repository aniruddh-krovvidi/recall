# Prism — analytics event pipeline

Prism ingests product analytics events from web and mobile clients, enriches them, and lands them in the warehouse. All events are Avro and must be registered in the schema registry; breaking schema changes are rejected at build time.

Owner: Lena Fischer (Data team). Language: Scala on Kafka.

## Architecture

Raw events land on the Kafka topic `events.raw` (48 partitions, 72-hour retention). The enrichment job joins user and device attributes and writes to `events.enriched`. Events arriving more than 2 hours late are dropped and counted in `prism_late_events_total`.

## Configuration

Environment variables: `PRISM_LATE_WINDOW_HOURS` (default 2), `PRISM_BOOTSTRAP_SERVERS`, `PRISM_SCHEMA_REGISTRY_URL`. The admin UI listens on port 7800.

## Runbook

To backfill a time range, run `prism backfill --from <iso> --to <iso> --topic events.raw --rate 5000` and watch `prism_backfill_progress`. Backfills replay into the same enrichment job, so keep the rate under 5000 events per second during business hours.
