# Backfill Prism events

Replays events for a time range through the enrichment job.

## Steps

1. Run `prism backfill --from 2026-07-01T00:00Z --to 2026-07-02T00:00Z --topic events.raw --rate 5000`.
2. Watch `prism_backfill_progress` in Grafana.
3. Keep the rate at or below 5000 events per second during business hours.

## Gotchas

Backfilled events older than the late-event window are not dropped; the backfill path bypasses that check.
