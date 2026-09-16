# Renew your SSH certificate

SSH access to hosts uses short-lived certificates instead of static keys.

## Steps

1. Run `ok ssh-cert renew`; it opens SSO in the browser.
2. Certificates are valid for 12 hours.
3. Verify with `ssh-add -L`, which should list a cert ending in `-cert.pub`.

## Gotchas

If SSO succeeds but `ssh` still fails, your local `ssh-agent` may not be running; `ok ssh-cert renew` prints the export line to fix it.
