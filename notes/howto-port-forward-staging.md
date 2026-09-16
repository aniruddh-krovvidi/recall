# Port-forward to a staging service

Reach a staging service from your laptop without exposing it publicly.

## Steps

1. Run `ok pf staging <service> <local-port>:<remote-port>`, for example `ok pf staging ledger 8071:8071`.
2. The service is now reachable at `localhost:<local-port>`.
3. Port-forward sessions expire after 8 hours.

## Gotchas

Production port-forwarding requires a break-glass ticket and is logged.
