# Page the on-call engineer

Pages go through Sentinel so escalation and quiet hours apply.

## Steps

1. Run `sentinelctl page --team sre --severity high --message "short description"`.
2. Use severity `high` for anything customer-facing; `low` pages are held until 09:00 local time.
3. For a SEV1, also open an incident with `ok incident new --sev 1`.

## Gotchas

Paging yourself to test routing counts against the team's page budget; use `sentinelctl route --dry-run` instead.
