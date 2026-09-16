# Payments weekly sync — 2026-07-13

Attendees: Priya Natarajan, Oscar Lindqvist, Mei Tanaka.

A partner sent a 700-posting transaction and only the first 500 were recorded.

## Decisions

- Ledger will reject transactions with more than 500 postings with HTTP 422 instead of silently truncating them.
- Mei will add the `ledger_rejected_transactions_total` metric with a reason label.

## Action items

- Mei: ship the 422 change and the metric together.
