# Install and configure the ok CLI

`ok` is the entry point for deploys, incidents, and port-forwarding.

## Steps

1. Install with `brew install example/tap/ok`.
2. Run `ok login` to authenticate with SSO.
3. Set `default_env = "staging"` in `~/.config/ok/config.toml` so commands target staging unless you say otherwise.

## Gotchas

`ok` refuses to run production commands unless `default_env` is set explicitly or `--env prod` is passed.
