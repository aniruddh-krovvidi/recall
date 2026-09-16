# Platform weekly sync — 2026-07-13

Attendees: Marcus Oyelaran, Amara Chen, Nikolai Petrov, Jae Park.

Two incidents last month traced back to forced deploys skipping the canary.

## Decisions

- Deprecate `ok deploy --force`; it will be removed on 2026-09-01 and canary is the only path after that.
- Security rejected the 45-day rotation proposal; Keyring database credentials stay at 30 days.

## Action items

- Jae: write ADR-031 covering the Node 22 upgrade for all TypeScript services.
