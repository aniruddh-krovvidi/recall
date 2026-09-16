# Run a canary deploy

Canary is the default deploy flow for every service.

## Steps

1. Run `ok canary start <service> --percent 5` to send 5% of traffic to the new version.
2. Watch the error rate and latency panels for at least 15 minutes.
3. Run `ok canary promote <service>` to finish, or `ok canary abort <service>` to roll back instantly.

## Gotchas

A canary left running for more than 4 hours is aborted automatically.
