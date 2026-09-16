# Reset a stuck Tempo job

Runs occasionally hang on an external dependency.

## Steps

1. Find the run with `tempoctl runs --job <name> --state RUNNING`.
2. Kill it with `tempoctl kill <run-id>`.
3. Re-run immediately with `tempoctl retry <run-id>` instead of waiting for the next schedule.

## Gotchas

Killing a run does not roll back partial writes; check the job's idempotency notes first.
