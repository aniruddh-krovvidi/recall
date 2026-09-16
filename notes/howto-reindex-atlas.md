# Reindex Atlas

Rebuild the search index when it is behind or corrupt.

## Steps

1. For a small lag, run `atlasctl reindex --since 24h`.
2. For a corrupt index, run `atlasctl reindex --full`; expect about 25 minutes.
3. Confirm recovery by watching `atlas_index_lag_seconds` drop to zero.

## Gotchas

A full reindex doubles Elasticsearch disk usage while it runs.
