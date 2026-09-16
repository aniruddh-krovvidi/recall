# SRE weekly sync — 2026-07-13

Attendees: Hana Kobayashi, Ines Duarte, Felix Brandt.

A cache-miss storm on Monday pulled 2 TB from upstream after GC.

## Decisions

- Raise the Harbor garbage collection minimum age from 30 days to 45 days.

## Action items

- Ines: set `HARBOR_GC_MIN_AGE_DAYS=45` before Sunday.
