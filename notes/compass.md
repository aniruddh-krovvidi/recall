# Compass — support ticket search

Compass is the search UI support agents use to find tickets. It indexes the helpdesk export every 5 minutes and supports a small query language such as `status:open assignee:me`.

Owner: Yusuf Adeyemi (Support Tools team). Language: TypeScript on Node 22.

## Architecture

Tickets are indexed into Elasticsearch with BM25 ranking and a synonyms file (`synonyms.txt`) that maps product nicknames to canonical names. Saved searches are evaluated once a day and emailed to their owner at 08:00 UTC.

## Configuration

Environment variables: `COMPASS_ES_URL`, `COMPASS_SYNC_MINUTES` (default 5), `COMPASS_DIGEST_HOUR_UTC` (default 8). Listens on port 3300.

## Runbook

If agents report missing tickets, check `compass_sync_lag_seconds`. A full index rebuild with `compassctl rebuild` takes about 12 minutes and can run while the old index keeps serving.
