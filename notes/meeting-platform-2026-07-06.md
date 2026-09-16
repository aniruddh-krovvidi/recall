# Platform weekly sync — 2026-07-06

Attendees: Marcus Oyelaran, Amara Chen, Nikolai Petrov, Jae Park.

Redis CPU on the Beacon cluster has been above 70% for two weeks.

## Decisions

- Raise the Beacon snapshot interval from 2 seconds to 5 seconds to cut Redis load; SDK caches make the difference invisible to callers.
- Amara will draft a proposal to extend Keyring database credential rotation from 30 to 45 days, pending security review.

## Action items

- Nikolai: confirm the Tempo default retry count of 2 is documented in the onboarding guide.
- Marcus: ship the snapshot interval change behind a config flag.
