# Add a feature flag in Beacon

Flags are created from the CLI and targeted from the console.

## Steps

1. Run `beacon flags create --name checkout.new_summary --type boolean --default false`.
2. Add targeting rules in the Beacon console; a flag can have at most 64 rules.
3. Verify with `beacon flags eval checkout.new_summary --user u_123`.

## Gotchas

Flag names are permanent; create a new flag rather than renaming one.
