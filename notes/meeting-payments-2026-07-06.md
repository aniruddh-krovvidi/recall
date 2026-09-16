# Payments weekly sync — 2026-07-06

Attendees: Priya Natarajan, Oscar Lindqvist, Mei Tanaka.

Nightly reconciliation catches drift too late for same-day fixes.

## Decisions

- Move Ledger reconciliation from nightly to hourly starting July 20; Oscar owns the change.
- Chargebacks will be posted as a separate transaction type `chargeback` rather than a reversed sale.

## Action items

- Oscar: benchmark the hourly reconciliation query against the replica.
