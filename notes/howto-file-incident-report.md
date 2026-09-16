# Open an incident

Incidents are opened from the CLI so the channel and doc are created consistently.

## Steps

1. Run `ok incident new --sev 2 --title "short title"`.
2. The CLI creates the Slack channel `#inc-<id>` and a postmortem doc from the template.
3. Post status updates in the channel at least every 30 minutes for SEV1 and every hour for SEV2.

## Gotchas

Only the incident commander closes the incident; use `ok incident close <id>`.
