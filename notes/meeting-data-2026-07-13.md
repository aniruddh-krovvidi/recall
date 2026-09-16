# Data weekly sync — 2026-07-13

Attendees: Lena Fischer, Devon Ashby, Rahul Menon, Chloe Bennett.

Storage cost review: restored objects are rarely touched after the first few days.

## Decisions

- Reduce the Glacier hot-retention period after a restore from 14 days to 7 days, saving an estimated $3,200 per month.

## Action items

- Rahul: change `GLACIER_RESTORE_HOT_DAYS` and update the runbook.
