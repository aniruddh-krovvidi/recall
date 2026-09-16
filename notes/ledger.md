# Ledger — double-entry accounting service

Ledger is the system of record for money movement. Every transaction is a set of postings that must sum to zero; the service rejects anything that does not balance. Journal rows are immutable and retained for 7 years for audit.

Owner: Priya Natarajan (Payments team). Language: Go 1.23.

## Architecture

Two Postgres 16 tables carry the load: `journal` (one row per transaction) and `postings` (one row per account leg). Writes go through a single `POST /v1/transactions` endpoint that validates balance, currency, and idempotency key before committing. Reads are served from a read replica. The SLO is 99.9% availability with p99 write latency under 120ms.

## Configuration

Environment variables: `LEDGER_DB_URL` (primary), `LEDGER_REPLICA_URL`, `LEDGER_MAX_POSTINGS_PER_TXN` (default 500), `LEDGER_IDEMPOTENCY_TTL_HOURS` (default 48). The service listens on port 8071. Deploys happen on Tuesday and Thursday via `ok deploy ledger`.

## Runbook

Alert `LedgerReconciliationDrift` fires when the reconciliation job finds drift above 0.01% between journal totals and the bank feed. First step: run `ledgerctl reconcile --dry-run` to list the offending accounts, then check whether a bank file arrived late. Never edit journal rows by hand; post a correcting transaction instead.
