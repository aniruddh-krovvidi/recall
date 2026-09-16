# Get read-replica database credentials

Ad-hoc queries go to the read replica, never the primary.

## Steps

1. Run `keyringctl lease db/<service>/replica --ttl 4h` to get a temporary credential.
2. Connect with `psql "$(keyringctl url db/ledger/replica)"`.
3. The lease expires after the TTL; the maximum TTL is 8 hours.

## Gotchas

Replica lag can reach a few seconds during migrations; do not use the replica for correctness checks right after a deploy.
