# Harbor — container registry pull-through cache

Harbor sits between our clusters and upstream registries (Docker Hub and GHCR) so image pulls do not depend on upstream availability or rate limits. All images should be referenced as `harbor.internal/<upstream>/<image>`.

Owner: Ines Duarte (SRE team). Language: Rust.

## Architecture

Blobs are stored in the S3 bucket `harbor-blobs-prod`; manifests are cached in a local RocksDB. A pull that misses the cache is fetched once from upstream and served to all waiters. Each team is limited to 100 pulls per minute to protect upstream quotas.

## Configuration

Environment variables: `HARBOR_GC_MIN_AGE_DAYS` (default 30), `HARBOR_UPSTREAMS` (comma-separated), `HARBOR_OFFLINE` (set to 1 to serve only cached content). Listens on port 5000. Garbage collection runs every Sunday at 02:00 UTC and deletes blobs not pulled within the minimum age.

## Runbook

If manifest requests return 502, look at `harbor_upstream_errors_total` by upstream. If Docker Hub is down, set `HARBOR_OFFLINE=1` and redeploy; cached images keep working and cache misses fail fast instead of hanging.
