# Glacier — cold storage archival

Glacier moves objects that have not been touched for 90 days from the hot bucket to the archive tier, cutting storage cost by roughly 80% for old data. Restores are asynchronous.

Owner: Rahul Menon (Data team). Language: Python 3.12.

## Architecture

A nightly scan compares object access times against the 90-day threshold and enqueues moves. A restore request takes up to 4 hours to complete, and a restored object stays in the hot tier for 14 days before it becomes eligible for archival again. The per-bucket manifest is a SQLite file.

## Configuration

Environment variables: `GLACIER_COLD_AFTER_DAYS` (default 90), `GLACIER_RESTORE_HOT_DAYS` (default 14), `GLACIER_MANIFEST_DIR`. The admin API listens on port 8200.

## Runbook

Alert `GlacierRestoreBacklog` fires when more than 200 restore requests are pending. Check the archive provider status page first; if the provider is healthy, scale the restore workers with `ok scale glacier-restore 4`.
