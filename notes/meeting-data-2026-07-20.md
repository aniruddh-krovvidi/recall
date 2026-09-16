# Data weekly sync — 2026-07-20

Attendees: Lena Fischer, Devon Ashby, Rahul Menon, Chloe Bennett.

Half of the new warehouse tables have no owner in Atlas.

## Decisions

- Every new warehouse table must have an `owner` tag in Atlas or the migration CI check fails; Chloe builds the check.

## Action items

- Chloe: ship the CI check by July 31.
- Devon: backfill owners for the 40 untagged tables.
