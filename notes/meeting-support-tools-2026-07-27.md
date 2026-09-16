# Support Tools weekly sync — 2026-07-27

Attendees: Tomasz Wróbel, Yusuf Adeyemi, Grace Whitfield.

Postmortem for the render queue backlog on July 22.

## Decisions

- Grow the Quill Chromium worker pool from 8 to 12 after the render queue backlog incident.

## Action items

- Tomasz: set `QUILL_WORKERS=12` and watch memory for a week.
