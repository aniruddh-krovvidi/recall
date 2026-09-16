# Run a Ledger schema migration

Ledger migrations run against the primary and must be planned before they are applied.

## Steps

1. Run `ledgerctl migrate plan` and read the generated SQL.
2. Apply with `ledgerctl migrate apply --lock-timeout 5s` so a blocked lock fails fast instead of stalling writes.
3. Only run migrations inside the Tuesday or Thursday deploy window.

## Gotchas

Adding a NOT NULL column to `postings` requires a backfill migration first; the table has billions of rows.
