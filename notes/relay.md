# Relay — outbound webhook delivery

Relay delivers webhooks to partner endpoints. Every request is signed with HMAC-SHA256 and the signature is sent in the `X-Relay-Signature` header so partners can verify authenticity.

Owner: Sofia Marchetti (Growth team). Language: Go 1.23.

## Architecture

Deliveries are retried 6 times with exponential backoff: 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours, and 24 hours. After the final failure the event is written to the `relay_dlq` dead-letter table. An endpoint that fails 50 times in a row is automatically disabled and its owner is emailed.

## Configuration

Environment variables: `RELAY_MAX_ATTEMPTS` (default 6), `RELAY_DISABLE_AFTER_FAILURES` (default 50), `RELAY_SIGNING_KEY_PATH`. Listens on port 6100.

## Runbook

To replay dead-lettered events for a partner, run `relayctl replay --endpoint <endpoint-id>`. To re-enable an auto-disabled endpoint, run `relayctl endpoints enable <endpoint-id>` after confirming with the partner that their receiver is fixed.
