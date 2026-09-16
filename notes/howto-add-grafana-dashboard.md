# Add a Grafana dashboard

Dashboards are provisioned from the repo, not edited in the UI.

## Steps

1. Add the dashboard JSON under `infra/grafana/dashboards/<team>/`.
2. Run `ok grafana lint` to catch missing datasource variables.
3. Merge; the dashboard is provisioned within 5 minutes.

## Gotchas

Edits made in the Grafana UI are overwritten on the next provisioning run.
