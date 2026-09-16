# Beacon — feature flag service

Beacon serves feature flags to every service and client app. Flags are boolean, string, or percentage rollouts with targeting rules. The kill switch `beacon flags disable <name>` propagates to all SDKs within 10 seconds.

Owner: Marcus Oyelaran (Platform team). Language: TypeScript on Node 22.

## Architecture

Flag definitions live in Postgres. A snapshot builder pushes the full flag set to Redis every 2 seconds, and SDKs poll `GET /v1/snapshot` with a 30-second local cache TTL. Evaluation happens client-side so the SLO is p99 evaluation latency under 5ms with no network call on the hot path.

## Configuration

Environment variables: `BEACON_SNAPSHOT_INTERVAL_MS` (default 2000), `BEACON_MAX_RULES` (default 64 rules per flag), `BEACON_REDIS_URL`. The HTTP API listens on port 4400. Flag names are dot-namespaced, e.g. `checkout.new_summary`.

## Runbook

Alert `BeaconSnapshotStale` fires when the snapshot age in Redis exceeds 60 seconds. Check the snapshot builder pod logs for Postgres connection errors; restarting the builder with `ok restart beacon-snapshot` is safe because SDKs keep serving their last cached snapshot.
