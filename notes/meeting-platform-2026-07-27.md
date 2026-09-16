# Platform weekly sync — 2026-07-27

Attendees: Marcus Oyelaran, Amara Chen, Nikolai Petrov, Jae Park.

npm install times in CI are the slowest step for most TypeScript repos.

## Decisions

- Adopt pnpm for all TypeScript repositories; Jae owns the migration with a deadline of end of Q3.
- Keep the Beacon limit of 64 rules per flag; the one team asking for more will split their flag.

## Action items

- Jae: migrate Beacon and Compass to pnpm first as pilots.
