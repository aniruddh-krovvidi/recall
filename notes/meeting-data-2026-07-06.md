# Data weekly sync — 2026-07-06

Attendees: Lena Fischer, Devon Ashby, Rahul Menon, Chloe Bennett.

Mobile clients buffer events offline, so a lot of valid events arrive hours late.

## Decisions

- Raise the Prism late-event window from 2 hours to 6 hours for events from mobile clients; web stays at 2 hours.
- Atlas index refresh stays at 10 minutes; nobody has asked for faster.

## Action items

- Lena: add a `client_platform` check before the late-event drop.
