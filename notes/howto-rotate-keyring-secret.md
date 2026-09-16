# Rotate a secret in Keyring

Use this when a credential needs a new version before its automatic rotation.

## Steps

1. Run `keyringctl rotate --secret db/ledger/primary` (replace the path with your secret).
2. Confirm the new version with `keyringctl versions db/ledger/primary`.
3. Wait up to 60 seconds for `keyring-agent` on each pod to pick up the new value; check `/run/keyring/db/ledger/primary` if in doubt.

## Gotchas

Rotating a database credential creates a new database role; the old role is dropped 10 minutes later, so long-running transactions on the old credential will fail.
