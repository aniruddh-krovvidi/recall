# Platform weekly sync — 2026-07-20

Attendees: Marcus Oyelaran, Amara Chen, Nikolai Petrov, Jae Park.

Readiness probes are inconsistent across services, which confuses the rollout tooling.

## Decisions

- Every Platform service must expose separate `/healthz` and `/readyz` endpoints by August 15.
- Raise Tempo concurrency from 32 to 48 on the `nightly` worker pool only; the default pool stays at 32.

## Action items

- Nikolai: roll out the nightly pool change on Thursday.
- Amara: audit which services still lack `/readyz`.
