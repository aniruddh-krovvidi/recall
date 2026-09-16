# Support Tools weekly sync — 2026-07-06

Attendees: Tomasz Wróbel, Yusuf Adeyemi, Grace Whitfield.

Large invoices for enterprise accounts hit the Quill page limit.

## Decisions

- Raise the Quill page limit from 40 to 60 pages for invoices only; other document types keep the 40-page limit.

## Action items

- Tomasz: add a per-document-type override for `QUILL_MAX_PAGES`.
