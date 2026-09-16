# Keyring — secrets distribution

Keyring stores and distributes secrets to services. Every secret is versioned. Database credentials rotate automatically every 30 days and API keys every 90 days.

Owner: Amara Chen (Platform team). Language: Go 1.23.

## Architecture

Services never call Keyring directly: the `keyring-agent` sidecar authenticates with the pod identity over mTLS, fetches the secrets the service is allowed to read, and writes them to the tmpfs mount `/run/keyring`. The agent re-fetches within 60 seconds of a rotation.

## Configuration

Environment variables: `KEYRING_ROTATE_DB_DAYS` (default 30), `KEYRING_ROTATE_API_DAYS` (default 90), `KEYRING_AUDIT_RETENTION_DAYS` (default 400). Listens on port 8443 with mTLS only. Every read is written to the `keyring_audit` table.

## Runbook

For a leaked secret, run `keyringctl revoke --secret <path> --all-versions`; this forces an immediate rotation and invalidates every cached copy. Then search `keyring_audit` for reads of that path in the last 400 days to scope the incident.
