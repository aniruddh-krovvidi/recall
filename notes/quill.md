# Quill — markdown and HTML to PDF rendering

Quill renders invoices, contracts, and reports to PDF. Callers POST markdown or HTML to `/render` and receive a PDF. Documents longer than 40 pages are rejected with HTTP 413.

Owner: Tomasz Wróbel (Support Tools team). Language: Python 3.12.

## Architecture

A pool of 8 headless Chromium workers renders documents; the API process queues jobs and streams the result back. Each render has a 45-second timeout. Fonts are loaded from `/opt/quill/fonts`; Inter and JetBrains Mono are bundled, other fonts must be added to the image.

## Configuration

Environment variables: `QUILL_WORKERS` (default 8), `QUILL_MAX_PAGES` (default 40), `QUILL_RENDER_TIMEOUT_S` (default 45). Listens on port 8090. Paper size defaults to Letter; pass `?paper=A4` to override.

## Runbook

Zombie Chromium processes show up as a slow climb in memory with no queue growth. Run `quillctl workers restart` to recycle the pool; in-flight renders are retried automatically by the API process.
