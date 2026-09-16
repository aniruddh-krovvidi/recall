# Set up the VPN on a new laptop

All internal services are only reachable over the VPN.

## Steps

1. Install the `tunnel` client from the software portal.
2. Run `tunnel login --org example` and complete SSO with your YubiKey.
3. Pick the `corp-eu` or `corp-us` profile depending on your office; both reach every internal service.

## Gotchas

The VPN session expires after 12 hours; re-run `tunnel login` when `harbor.internal` stops resolving.
