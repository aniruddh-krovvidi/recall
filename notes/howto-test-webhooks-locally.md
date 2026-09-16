# Test Relay webhooks locally

Receive real webhook deliveries on your laptop.

## Steps

1. Run `relayctl tunnel --port 3000` to get a temporary public URL that forwards to your local server.
2. Emit a sample event with `relayctl emit order.created --endpoint <url>`.
3. Verify the signature with `relayctl verify --secret <signing-secret> --body payload.json --signature <header-value>`.

## Gotchas

Tunnel URLs expire after 2 hours.
