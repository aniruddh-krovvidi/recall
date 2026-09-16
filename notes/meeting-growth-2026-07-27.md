# Growth weekly sync — 2026-07-27

Attendees: Sofia Marchetti, Ben Okafor, Ana Souza.

Partners cannot tell which payload version they are receiving.

## Decisions

- Webhook payloads gain a `schema_version` field defaulting to 2, starting August 15; version 1 payloads are still emitted for partners who opt out.

## Action items

- Sofia: publish the payload change in the partner changelog.
