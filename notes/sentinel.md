# Sentinel — alert routing and paging

Sentinel receives Alertmanager webhooks and decides who gets paged. Routing is by the `team` label on the alert, and every team has a primary and secondary on-call in the rotation.

Owner: Hana Kobayashi (SRE team). Language: Go 1.23.

## Architecture

Escalation is timer-based: the primary on-call is paged first, the secondary after 15 minutes without acknowledgement, and the team lead after 30 minutes. Pages with severity `low` are held during quiet hours and delivered at 09:00 in the on-call's local time zone.

## Configuration

Environment variables: `SENTINEL_ESCALATION_MINUTES` (default 15), `SENTINEL_QUIET_HOURS` (default 22:00-09:00), `SENTINEL_ROUTES_FILE`. Listens on port 9411. Routes are declared in `routes.yaml` keyed by team name.

## Runbook

To check where an alert would go without paging anyone, run `sentinelctl route --dry-run --team payments --severity high`. If nobody is being paged at all, verify the Alertmanager webhook secret matches `SENTINEL_WEBHOOK_SECRET`.
