# Atlas — data catalog and lineage

Atlas lets anyone find warehouse tables, see who owns them, and trace lineage from source to dashboard. Search supports `owner:` and `tag:` filters in addition to free text.

Owner: Devon Ashby (Data team). Language: Kotlin on JVM 21.

## Architecture

Table metadata is pulled from the warehouse `information_schema` every 10 minutes and indexed into the Elasticsearch 8 index `atlas-assets`. The lineage graph is stored in Postgres in an `edges` table and rendered on demand.

## Configuration

Environment variables: `ATLAS_ES_URL`, `ATLAS_REFRESH_MINUTES` (default 10), `ATLAS_DB_URL`. The web UI and API listen on port 7700.

## Runbook

Alert `AtlasIndexLag` fires when the index is more than 30 minutes behind the warehouse. A full reindex with `atlasctl reindex --full` takes about 25 minutes; prefer `atlasctl reindex --since 24h` unless the index is corrupt.
