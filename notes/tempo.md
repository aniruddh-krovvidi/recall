# Tempo — batch job scheduler

Tempo runs scheduled batch jobs. Job definitions live in `jobs/*.yaml` in each service repo, with a cron expression that may carry a `TZ=` prefix, e.g. `TZ=Europe/Berlin 0 6 * * *`.

Owner: Nikolai Petrov (Platform team). Language: Python 3.12.

## Architecture

Workers pull runs from a Postgres-backed queue. Each worker pool runs at most 32 concurrent jobs. A run that exceeds its `timeout` (default 6 hours) is killed and marked `TIMED_OUT`. Failed runs are retried 2 times by default with a 10-minute delay between attempts.

## Configuration

Environment variables: `TEMPO_POOL_CONCURRENCY` (default 32), `TEMPO_DEFAULT_TIMEOUT_HOURS` (default 6), `TEMPO_DEFAULT_RETRIES` (default 2). The API and UI listen on port 7000.

## Runbook

A run that is stuck in `RUNNING` with no log output for over an hour can be killed with `tempoctl kill <run-id>`; the scheduler then applies the normal retry policy. Use `tempoctl runs --job <name> --state RUNNING` to find run ids.
