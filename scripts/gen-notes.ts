// Generates the synthetic knowledge base under notes/. Everything here is
// invented: fictional services, people, and decisions. Re-run with
// `npm run gen-notes`; the output is committed so the eval set is stable.
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

type Note = { slug: string; body: string };
const notes: Note[] = [];

// ---------------------------------------------------------------- projects
type Project = {
  slug: string; name: string; tagline: string; team: string; owner: string;
  lang: string; port: number; overview: string; architecture: string;
  configuration: string; runbook: string;
};

const projects: Project[] = [
  {
    slug: "ledger", name: "Ledger", tagline: "double-entry accounting service", team: "Payments",
    owner: "Priya Natarajan", lang: "Go 1.23", port: 8071,
    overview: "Ledger is the system of record for money movement. Every transaction is a set of postings that must sum to zero; the service rejects anything that does not balance. Journal rows are immutable and retained for 7 years for audit.",
    architecture: "Two Postgres 16 tables carry the load: `journal` (one row per transaction) and `postings` (one row per account leg). Writes go through a single `POST /v1/transactions` endpoint that validates balance, currency, and idempotency key before committing. Reads are served from a read replica. The SLO is 99.9% availability with p99 write latency under 120ms.",
    configuration: "Environment variables: `LEDGER_DB_URL` (primary), `LEDGER_REPLICA_URL`, `LEDGER_MAX_POSTINGS_PER_TXN` (default 500), `LEDGER_IDEMPOTENCY_TTL_HOURS` (default 48). The service listens on port 8071. Deploys happen on Tuesday and Thursday via `ok deploy ledger`.",
    runbook: "Alert `LedgerReconciliationDrift` fires when the reconciliation job finds drift above 0.01% between journal totals and the bank feed. First step: run `ledgerctl reconcile --dry-run` to list the offending accounts, then check whether a bank file arrived late. Never edit journal rows by hand; post a correcting transaction instead.",
  },
  {
    slug: "beacon", name: "Beacon", tagline: "feature flag service", team: "Platform",
    owner: "Marcus Oyelaran", lang: "TypeScript on Node 22", port: 4400,
    overview: "Beacon serves feature flags to every service and client app. Flags are boolean, string, or percentage rollouts with targeting rules. The kill switch `beacon flags disable <name>` propagates to all SDKs within 10 seconds.",
    architecture: "Flag definitions live in Postgres. A snapshot builder pushes the full flag set to Redis every 2 seconds, and SDKs poll `GET /v1/snapshot` with a 30-second local cache TTL. Evaluation happens client-side so the SLO is p99 evaluation latency under 5ms with no network call on the hot path.",
    configuration: "Environment variables: `BEACON_SNAPSHOT_INTERVAL_MS` (default 2000), `BEACON_MAX_RULES` (default 64 rules per flag), `BEACON_REDIS_URL`. The HTTP API listens on port 4400. Flag names are dot-namespaced, e.g. `checkout.new_summary`.",
    runbook: "Alert `BeaconSnapshotStale` fires when the snapshot age in Redis exceeds 60 seconds. Check the snapshot builder pod logs for Postgres connection errors; restarting the builder with `ok restart beacon-snapshot` is safe because SDKs keep serving their last cached snapshot.",
  },
  {
    slug: "harbor", name: "Harbor", tagline: "container registry pull-through cache", team: "SRE",
    owner: "Ines Duarte", lang: "Rust", port: 5000,
    overview: "Harbor sits between our clusters and upstream registries (Docker Hub and GHCR) so image pulls do not depend on upstream availability or rate limits. All images should be referenced as `harbor.internal/<upstream>/<image>`.",
    architecture: "Blobs are stored in the S3 bucket `harbor-blobs-prod`; manifests are cached in a local RocksDB. A pull that misses the cache is fetched once from upstream and served to all waiters. Each team is limited to 100 pulls per minute to protect upstream quotas.",
    configuration: "Environment variables: `HARBOR_GC_MIN_AGE_DAYS` (default 30), `HARBOR_UPSTREAMS` (comma-separated), `HARBOR_OFFLINE` (set to 1 to serve only cached content). Listens on port 5000. Garbage collection runs every Sunday at 02:00 UTC and deletes blobs not pulled within the minimum age.",
    runbook: "If manifest requests return 502, look at `harbor_upstream_errors_total` by upstream. If Docker Hub is down, set `HARBOR_OFFLINE=1` and redeploy; cached images keep working and cache misses fail fast instead of hanging.",
  },
  {
    slug: "quill", name: "Quill", tagline: "markdown and HTML to PDF rendering", team: "Support Tools",
    owner: "Tomasz Wróbel", lang: "Python 3.12", port: 8090,
    overview: "Quill renders invoices, contracts, and reports to PDF. Callers POST markdown or HTML to `/render` and receive a PDF. Documents longer than 40 pages are rejected with HTTP 413.",
    architecture: "A pool of 8 headless Chromium workers renders documents; the API process queues jobs and streams the result back. Each render has a 45-second timeout. Fonts are loaded from `/opt/quill/fonts`; Inter and JetBrains Mono are bundled, other fonts must be added to the image.",
    configuration: "Environment variables: `QUILL_WORKERS` (default 8), `QUILL_MAX_PAGES` (default 40), `QUILL_RENDER_TIMEOUT_S` (default 45). Listens on port 8090. Paper size defaults to Letter; pass `?paper=A4` to override.",
    runbook: "Zombie Chromium processes show up as a slow climb in memory with no queue growth. Run `quillctl workers restart` to recycle the pool; in-flight renders are retried automatically by the API process.",
  },
  {
    slug: "sentinel", name: "Sentinel", tagline: "alert routing and paging", team: "SRE",
    owner: "Hana Kobayashi", lang: "Go 1.23", port: 9411,
    overview: "Sentinel receives Alertmanager webhooks and decides who gets paged. Routing is by the `team` label on the alert, and every team has a primary and secondary on-call in the rotation.",
    architecture: "Escalation is timer-based: the primary on-call is paged first, the secondary after 15 minutes without acknowledgement, and the team lead after 30 minutes. Pages with severity `low` are held during quiet hours and delivered at 09:00 in the on-call's local time zone.",
    configuration: "Environment variables: `SENTINEL_ESCALATION_MINUTES` (default 15), `SENTINEL_QUIET_HOURS` (default 22:00-09:00), `SENTINEL_ROUTES_FILE`. Listens on port 9411. Routes are declared in `routes.yaml` keyed by team name.",
    runbook: "To check where an alert would go without paging anyone, run `sentinelctl route --dry-run --team payments --severity high`. If nobody is being paged at all, verify the Alertmanager webhook secret matches `SENTINEL_WEBHOOK_SECRET`.",
  },
  {
    slug: "atlas", name: "Atlas", tagline: "data catalog and lineage", team: "Data",
    owner: "Devon Ashby", lang: "Kotlin on JVM 21", port: 7700,
    overview: "Atlas lets anyone find warehouse tables, see who owns them, and trace lineage from source to dashboard. Search supports `owner:` and `tag:` filters in addition to free text.",
    architecture: "Table metadata is pulled from the warehouse `information_schema` every 10 minutes and indexed into the Elasticsearch 8 index `atlas-assets`. The lineage graph is stored in Postgres in an `edges` table and rendered on demand.",
    configuration: "Environment variables: `ATLAS_ES_URL`, `ATLAS_REFRESH_MINUTES` (default 10), `ATLAS_DB_URL`. The web UI and API listen on port 7700.",
    runbook: "Alert `AtlasIndexLag` fires when the index is more than 30 minutes behind the warehouse. A full reindex with `atlasctl reindex --full` takes about 25 minutes; prefer `atlasctl reindex --since 24h` unless the index is corrupt.",
  },
  {
    slug: "relay", name: "Relay", tagline: "outbound webhook delivery", team: "Growth",
    owner: "Sofia Marchetti", lang: "Go 1.23", port: 6100,
    overview: "Relay delivers webhooks to partner endpoints. Every request is signed with HMAC-SHA256 and the signature is sent in the `X-Relay-Signature` header so partners can verify authenticity.",
    architecture: "Deliveries are retried 6 times with exponential backoff: 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours, and 24 hours. After the final failure the event is written to the `relay_dlq` dead-letter table. An endpoint that fails 50 times in a row is automatically disabled and its owner is emailed.",
    configuration: "Environment variables: `RELAY_MAX_ATTEMPTS` (default 6), `RELAY_DISABLE_AFTER_FAILURES` (default 50), `RELAY_SIGNING_KEY_PATH`. Listens on port 6100.",
    runbook: "To replay dead-lettered events for a partner, run `relayctl replay --endpoint <endpoint-id>`. To re-enable an auto-disabled endpoint, run `relayctl endpoints enable <endpoint-id>` after confirming with the partner that their receiver is fixed.",
  },
  {
    slug: "glacier", name: "Glacier", tagline: "cold storage archival", team: "Data",
    owner: "Rahul Menon", lang: "Python 3.12", port: 8200,
    overview: "Glacier moves objects that have not been touched for 90 days from the hot bucket to the archive tier, cutting storage cost by roughly 80% for old data. Restores are asynchronous.",
    architecture: "A nightly scan compares object access times against the 90-day threshold and enqueues moves. A restore request takes up to 4 hours to complete, and a restored object stays in the hot tier for 14 days before it becomes eligible for archival again. The per-bucket manifest is a SQLite file.",
    configuration: "Environment variables: `GLACIER_COLD_AFTER_DAYS` (default 90), `GLACIER_RESTORE_HOT_DAYS` (default 14), `GLACIER_MANIFEST_DIR`. The admin API listens on port 8200.",
    runbook: "Alert `GlacierRestoreBacklog` fires when more than 200 restore requests are pending. Check the archive provider status page first; if the provider is healthy, scale the restore workers with `ok scale glacier-restore 4`.",
  },
  {
    slug: "prism", name: "Prism", tagline: "analytics event pipeline", team: "Data",
    owner: "Lena Fischer", lang: "Scala on Kafka", port: 7800,
    overview: "Prism ingests product analytics events from web and mobile clients, enriches them, and lands them in the warehouse. All events are Avro and must be registered in the schema registry; breaking schema changes are rejected at build time.",
    architecture: "Raw events land on the Kafka topic `events.raw` (48 partitions, 72-hour retention). The enrichment job joins user and device attributes and writes to `events.enriched`. Events arriving more than 2 hours late are dropped and counted in `prism_late_events_total`.",
    configuration: "Environment variables: `PRISM_LATE_WINDOW_HOURS` (default 2), `PRISM_BOOTSTRAP_SERVERS`, `PRISM_SCHEMA_REGISTRY_URL`. The admin UI listens on port 7800.",
    runbook: "To backfill a time range, run `prism backfill --from <iso> --to <iso> --topic events.raw --rate 5000` and watch `prism_backfill_progress`. Backfills replay into the same enrichment job, so keep the rate under 5000 events per second during business hours.",
  },
  {
    slug: "compass", name: "Compass", tagline: "support ticket search", team: "Support Tools",
    owner: "Yusuf Adeyemi", lang: "TypeScript on Node 22", port: 3300,
    overview: "Compass is the search UI support agents use to find tickets. It indexes the helpdesk export every 5 minutes and supports a small query language such as `status:open assignee:me`.",
    architecture: "Tickets are indexed into Elasticsearch with BM25 ranking and a synonyms file (`synonyms.txt`) that maps product nicknames to canonical names. Saved searches are evaluated once a day and emailed to their owner at 08:00 UTC.",
    configuration: "Environment variables: `COMPASS_ES_URL`, `COMPASS_SYNC_MINUTES` (default 5), `COMPASS_DIGEST_HOUR_UTC` (default 8). Listens on port 3300.",
    runbook: "If agents report missing tickets, check `compass_sync_lag_seconds`. A full index rebuild with `compassctl rebuild` takes about 12 minutes and can run while the old index keeps serving.",
  },
  {
    slug: "keyring", name: "Keyring", tagline: "secrets distribution", team: "Platform",
    owner: "Amara Chen", lang: "Go 1.23", port: 8443,
    overview: "Keyring stores and distributes secrets to services. Every secret is versioned. Database credentials rotate automatically every 30 days and API keys every 90 days.",
    architecture: "Services never call Keyring directly: the `keyring-agent` sidecar authenticates with the pod identity over mTLS, fetches the secrets the service is allowed to read, and writes them to the tmpfs mount `/run/keyring`. The agent re-fetches within 60 seconds of a rotation.",
    configuration: "Environment variables: `KEYRING_ROTATE_DB_DAYS` (default 30), `KEYRING_ROTATE_API_DAYS` (default 90), `KEYRING_AUDIT_RETENTION_DAYS` (default 400). Listens on port 8443 with mTLS only. Every read is written to the `keyring_audit` table.",
    runbook: "For a leaked secret, run `keyringctl revoke --secret <path> --all-versions`; this forces an immediate rotation and invalidates every cached copy. Then search `keyring_audit` for reads of that path in the last 400 days to scope the incident.",
  },
  {
    slug: "tempo", name: "Tempo", tagline: "batch job scheduler", team: "Platform",
    owner: "Nikolai Petrov", lang: "Python 3.12", port: 7000,
    overview: "Tempo runs scheduled batch jobs. Job definitions live in `jobs/*.yaml` in each service repo, with a cron expression that may carry a `TZ=` prefix, e.g. `TZ=Europe/Berlin 0 6 * * *`.",
    architecture: "Workers pull runs from a Postgres-backed queue. Each worker pool runs at most 32 concurrent jobs. A run that exceeds its `timeout` (default 6 hours) is killed and marked `TIMED_OUT`. Failed runs are retried 2 times by default with a 10-minute delay between attempts.",
    configuration: "Environment variables: `TEMPO_POOL_CONCURRENCY` (default 32), `TEMPO_DEFAULT_TIMEOUT_HOURS` (default 6), `TEMPO_DEFAULT_RETRIES` (default 2). The API and UI listen on port 7000.",
    runbook: "A run that is stuck in `RUNNING` with no log output for over an hour can be killed with `tempoctl kill <run-id>`; the scheduler then applies the normal retry policy. Use `tempoctl runs --job <name> --state RUNNING` to find run ids.",
  },
];

for (const p of projects) {
  notes.push({
    slug: p.slug,
    body: `# ${p.name} — ${p.tagline}

${p.overview}

Owner: ${p.owner} (${p.team} team). Language: ${p.lang}.

## Architecture

${p.architecture}

## Configuration

${p.configuration}

## Runbook

${p.runbook}
`,
  });
}

// ---------------------------------------------------------------- meetings
type Meeting = { team: string; attendees: string[]; weeks: { decisions: string[]; actions: string[]; notes: string }[] };
const dates = ["2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03"];

const meetings: Meeting[] = [
  {
    team: "platform", attendees: ["Marcus Oyelaran", "Amara Chen", "Nikolai Petrov", "Jae Park"],
    weeks: [
      { notes: "Redis CPU on the Beacon cluster has been above 70% for two weeks.",
        decisions: ["Raise the Beacon snapshot interval from 2 seconds to 5 seconds to cut Redis load; SDK caches make the difference invisible to callers.", "Amara will draft a proposal to extend Keyring database credential rotation from 30 to 45 days, pending security review."],
        actions: ["Nikolai: confirm the Tempo default retry count of 2 is documented in the onboarding guide.", "Marcus: ship the snapshot interval change behind a config flag."] },
      { notes: "Two incidents last month traced back to forced deploys skipping the canary.",
        decisions: ["Deprecate `ok deploy --force`; it will be removed on 2026-09-01 and canary is the only path after that.", "Security rejected the 45-day rotation proposal; Keyring database credentials stay at 30 days."],
        actions: ["Jae: write ADR-031 covering the Node 22 upgrade for all TypeScript services."] },
      { notes: "Readiness probes are inconsistent across services, which confuses the rollout tooling.",
        decisions: ["Every Platform service must expose separate `/healthz` and `/readyz` endpoints by August 15.", "Raise Tempo concurrency from 32 to 48 on the `nightly` worker pool only; the default pool stays at 32."],
        actions: ["Nikolai: roll out the nightly pool change on Thursday.", "Amara: audit which services still lack `/readyz`."] },
      { notes: "npm install times in CI are the slowest step for most TypeScript repos.",
        decisions: ["Adopt pnpm for all TypeScript repositories; Jae owns the migration with a deadline of end of Q3.", "Keep the Beacon limit of 64 rules per flag; the one team asking for more will split their flag."],
        actions: ["Jae: migrate Beacon and Compass to pnpm first as pilots."] },
      { notes: "Quarter-end close is coming up and Payments asked for stability.",
        decisions: ["Freeze all production deploys from August 28 through September 1 for the quarter-end close; hotfixes need VP approval.", "Keyring agent 1.4 rollout is complete across all clusters; 1.3 will be removed from Harbor next week."],
        actions: ["Marcus: announce the deploy freeze in #engineering."] },
    ],
  },
  {
    team: "payments", attendees: ["Priya Natarajan", "Oscar Lindqvist", "Mei Tanaka"],
    weeks: [
      { notes: "Nightly reconciliation catches drift too late for same-day fixes.",
        decisions: ["Move Ledger reconciliation from nightly to hourly starting July 20; Oscar owns the change.", "Chargebacks will be posted as a separate transaction type `chargeback` rather than a reversed sale."],
        actions: ["Oscar: benchmark the hourly reconciliation query against the replica."] },
      { notes: "A partner sent a 700-posting transaction and only the first 500 were recorded.",
        decisions: ["Ledger will reject transactions with more than 500 postings with HTTP 422 instead of silently truncating them.", "Mei will add the `ledger_rejected_transactions_total` metric with a reason label."],
        actions: ["Mei: ship the 422 change and the metric together."] },
      { notes: "Hourly reconciliation has been live for a week with no false alarms.",
        decisions: ["Keep the reconciliation drift alert threshold at 0.01%; no need to loosen it.", "Add Brazilian real (BRL) as a supported currency in Q4, starting with read-only reporting."],
        actions: ["Priya: open the BRL project doc."] },
      { notes: "Support has been processing very old refunds without a second check.",
        decisions: ["Refunds for transactions older than 180 days now require manual approval in the admin console."],
        actions: ["Priya: write the manual approval runbook for support.", "Oscar: add the age check to the refund endpoint."] },
      { notes: "Postgres 16 end of support for our managed offering is next year.",
        decisions: ["Ledger moves to Postgres 17 during the August 12 maintenance window, 02:00 to 04:00 UTC, with a rehearsal on staging on August 5."],
        actions: ["Oscar: run the staging rehearsal and post timings."] },
    ],
  },
  {
    team: "data", attendees: ["Lena Fischer", "Devon Ashby", "Rahul Menon", "Chloe Bennett"],
    weeks: [
      { notes: "Mobile clients buffer events offline, so a lot of valid events arrive hours late.",
        decisions: ["Raise the Prism late-event window from 2 hours to 6 hours for events from mobile clients; web stays at 2 hours.", "Atlas index refresh stays at 10 minutes; nobody has asked for faster."],
        actions: ["Lena: add a `client_platform` check before the late-event drop."] },
      { notes: "Storage cost review: restored objects are rarely touched after the first few days.",
        decisions: ["Reduce the Glacier hot-retention period after a restore from 14 days to 7 days, saving an estimated $3,200 per month."],
        actions: ["Rahul: change `GLACIER_RESTORE_HOT_DAYS` and update the runbook."] },
      { notes: "Half of the new warehouse tables have no owner in Atlas.",
        decisions: ["Every new warehouse table must have an `owner` tag in Atlas or the migration CI check fails; Chloe builds the check."],
        actions: ["Chloe: ship the CI check by July 31.", "Devon: backfill owners for the 40 untagged tables."] },
      { notes: "The September launch is expected to triple event volume.",
        decisions: ["Repartition `events.raw` from 48 to 96 partitions before the September launch; Rahul runs the repartition on August 10."],
        actions: ["Rahul: schedule the repartition and notify consumers."] },
      { notes: "Only one consumer still reads the legacy topic.",
        decisions: ["Deprecate the legacy `events.v1` topic on October 1; the remaining consumer migrates to `events.enriched`."],
        actions: ["Lena: email the last consumer with the migration guide."] },
    ],
  },
  {
    team: "growth", attendees: ["Sofia Marchetti", "Ben Okafor", "Ana Souza"],
    weeks: [
      { notes: "Two partners had endpoints disabled during their own maintenance windows.",
        decisions: ["Raise the Relay endpoint auto-disable threshold from 50 to 100 consecutive failures."],
        actions: ["Sofia: change `RELAY_DISABLE_AFTER_FAILURES` and notify the partner list."] },
      { notes: "Referral bonus redesign is ready.",
        decisions: ["Run the referral bonus experiment behind the flag `growth.referral_bonus_v2` at 10% of new signups for two weeks."],
        actions: ["Ben: create the flag in Beacon and wire the dashboard."] },
      { notes: "Referral experiment results after two weeks.",
        decisions: ["The referral bonus experiment lifted signups by 4.1%; ramp `growth.referral_bonus_v2` to 50%."],
        actions: ["Ana: ramp the flag on Wednesday and re-check the dashboard Friday."] },
      { notes: "Partners cannot tell which payload version they are receiving.",
        decisions: ["Webhook payloads gain a `schema_version` field defaulting to 2, starting August 15; version 1 payloads are still emitted for partners who opt out."],
        actions: ["Sofia: publish the payload change in the partner changelog."] },
      { notes: "SMS onboarding has under 1% of signups and high cost per message.",
        decisions: ["Sunset the SMS onboarding channel by November 30."],
        actions: ["Ben: draft the customer notice."] },
    ],
  },
  {
    team: "support-tools", attendees: ["Tomasz Wróbel", "Yusuf Adeyemi", "Grace Whitfield"],
    weeks: [
      { notes: "Large invoices for enterprise accounts hit the Quill page limit.",
        decisions: ["Raise the Quill page limit from 40 to 60 pages for invoices only; other document types keep the 40-page limit."],
        actions: ["Tomasz: add a per-document-type override for `QUILL_MAX_PAGES`."] },
      { notes: "EU agents start before the saved-search digest arrives.",
        decisions: ["Move Compass saved-search digest emails from 08:00 UTC to 07:00 UTC."],
        actions: ["Yusuf: change `COMPASS_DIGEST_HOUR_UTC` to 7."] },
      { notes: "Agents want to sort by ticket priority without leaving the search box.",
        decisions: ["Add a `priority:` filter to the Compass query language; Grace owns it."],
        actions: ["Grace: ship the filter and update the query language help page."] },
      { notes: "Postmortem for the render queue backlog on July 22.",
        decisions: ["Grow the Quill Chromium worker pool from 8 to 12 after the render queue backlog incident."],
        actions: ["Tomasz: set `QUILL_WORKERS=12` and watch memory for a week."] },
      { notes: "The legacy ticket exporter has no owner.",
        decisions: ["Retire the legacy ticket exporter on September 15; Compass reads the helpdesk export directly."],
        actions: ["Yusuf: confirm no dashboards depend on the exporter."] },
    ],
  },
  {
    team: "sre", attendees: ["Hana Kobayashi", "Ines Duarte", "Felix Brandt"],
    weeks: [
      { notes: "Team leads are getting paged before the secondary has a chance to respond.",
        decisions: ["Sentinel secondary escalation stays at 15 minutes; team-lead escalation moves from 30 minutes to 45 minutes."],
        actions: ["Hana: update `routes.yaml` and the Sentinel doc."] },
      { notes: "A cache-miss storm on Monday pulled 2 TB from upstream after GC.",
        decisions: ["Raise the Harbor garbage collection minimum age from 30 days to 45 days."],
        actions: ["Ines: set `HARBOR_GC_MIN_AGE_DAYS=45` before Sunday."] },
      { notes: "Postmortems are taking weeks to land.",
        decisions: ["Every SEV1 postmortem is due within 5 business days of the incident; Felix updates the incident policy."],
        actions: ["Felix: edit the incident severity policy doc."] },
      { notes: "Canary adoption is uneven across Go services.",
        decisions: ["All Go services adopt the `ok canary` flow by the end of Q3."],
        actions: ["Ines: list the Go services still deploying without canary."] },
      { notes: "Annual resilience planning.",
        decisions: ["The quarterly failover drill is scheduled for September 9 and will fail traffic over to the `eu-west-2` region."],
        actions: ["Hana: book the drill and send the calendar hold."] },
    ],
  },
];

const teamTitle: Record<string, string> = {
  platform: "Platform", payments: "Payments", data: "Data", growth: "Growth", "support-tools": "Support Tools", sre: "SRE",
};

for (const m of meetings) {
  m.weeks.forEach((w, i) => {
    const date = dates[i]!;
    notes.push({
      slug: `meeting-${m.team}-${date}`,
      body: `# ${teamTitle[m.team]} weekly sync — ${date}

Attendees: ${m.attendees.join(", ")}.

${w.notes}

## Decisions

${w.decisions.map((d) => `- ${d}`).join("\n")}

## Action items

${w.actions.map((a) => `- ${a}`).join("\n")}
`,
    });
  });
}

// ---------------------------------------------------------------- how-tos
type HowTo = { slug: string; title: string; intro: string; steps: string[]; gotcha: string };
const howtos: HowTo[] = [
  { slug: "howto-rotate-keyring-secret", title: "Rotate a secret in Keyring", intro: "Use this when a credential needs a new version before its automatic rotation.",
    steps: ["Run `keyringctl rotate --secret db/ledger/primary` (replace the path with your secret).", "Confirm the new version with `keyringctl versions db/ledger/primary`.", "Wait up to 60 seconds for `keyring-agent` on each pod to pick up the new value; check `/run/keyring/db/ledger/primary` if in doubt."],
    gotcha: "Rotating a database credential creates a new database role; the old role is dropped 10 minutes later, so long-running transactions on the old credential will fail." },
  { slug: "howto-run-ledger-migration", title: "Run a Ledger schema migration", intro: "Ledger migrations run against the primary and must be planned before they are applied.",
    steps: ["Run `ledgerctl migrate plan` and read the generated SQL.", "Apply with `ledgerctl migrate apply --lock-timeout 5s` so a blocked lock fails fast instead of stalling writes.", "Only run migrations inside the Tuesday or Thursday deploy window."],
    gotcha: "Adding a NOT NULL column to `postings` requires a backfill migration first; the table has billions of rows." },
  { slug: "howto-add-feature-flag", title: "Add a feature flag in Beacon", intro: "Flags are created from the CLI and targeted from the console.",
    steps: ["Run `beacon flags create --name checkout.new_summary --type boolean --default false`.", "Add targeting rules in the Beacon console; a flag can have at most 64 rules.", "Verify with `beacon flags eval checkout.new_summary --user u_123`."],
    gotcha: "Flag names are permanent; create a new flag rather than renaming one." },
  { slug: "howto-page-oncall", title: "Page the on-call engineer", intro: "Pages go through Sentinel so escalation and quiet hours apply.",
    steps: ["Run `sentinelctl page --team sre --severity high --message \"short description\"`.", "Use severity `high` for anything customer-facing; `low` pages are held until 09:00 local time.", "For a SEV1, also open an incident with `ok incident new --sev 1`."],
    gotcha: "Paging yourself to test routing counts against the team's page budget; use `sentinelctl route --dry-run` instead." },
  { slug: "howto-backfill-prism-events", title: "Backfill Prism events", intro: "Replays events for a time range through the enrichment job.",
    steps: ["Run `prism backfill --from 2026-07-01T00:00Z --to 2026-07-02T00:00Z --topic events.raw --rate 5000`.", "Watch `prism_backfill_progress` in Grafana.", "Keep the rate at or below 5000 events per second during business hours."],
    gotcha: "Backfilled events older than the late-event window are not dropped; the backfill path bypasses that check." },
  { slug: "howto-restore-from-glacier", title: "Restore an archived object from Glacier", intro: "Archived objects are not readable until restored.",
    steps: ["Run `glacierctl restore s3://bucket/path/to/object`; the command prints a request id.", "Poll with `glacierctl status <request-id>`; restores take up to 4 hours.", "The object stays in the hot tier for the configured hot-retention period after it lands."],
    gotcha: "Bulk restores of more than 1,000 objects should be filed as a ticket to the Data team so they can batch them." },
  { slug: "howto-set-up-vpn", title: "Set up the VPN on a new laptop", intro: "All internal services are only reachable over the VPN.",
    steps: ["Install the `tunnel` client from the software portal.", "Run `tunnel login --org example` and complete SSO with your YubiKey.", "Pick the `corp-eu` or `corp-us` profile depending on your office; both reach every internal service."],
    gotcha: "The VPN session expires after 12 hours; re-run `tunnel login` when `harbor.internal` stops resolving." },
  { slug: "howto-devbox-cli", title: "Use the devbox CLI", intro: "devbox gives every engineer a cloud development VM.",
    steps: ["Run `devbox up` to create a VM with 4 vCPUs and 16 GB of memory.", "Run `devbox ssh` to connect, or `devbox sync` to mirror your local checkout.", "The VM auto-stops after 2 hours idle; `devbox up` resumes it with disk intact."],
    gotcha: "A `devbox destroy` deletes the disk; commit and push before destroying." },
  { slug: "howto-rotate-ssh-cert", title: "Renew your SSH certificate", intro: "SSH access to hosts uses short-lived certificates instead of static keys.",
    steps: ["Run `ok ssh-cert renew`; it opens SSO in the browser.", "Certificates are valid for 12 hours.", "Verify with `ssh-add -L`, which should list a cert ending in `-cert.pub`."],
    gotcha: "If SSO succeeds but `ssh` still fails, your local `ssh-agent` may not be running; `ok ssh-cert renew` prints the export line to fix it." },
  { slug: "howto-request-kafka-topic", title: "Request a new Kafka topic", intro: "Topics are managed as code.",
    steps: ["Open a PR to `infra/kafka/topics.yaml` with the topic name, partition count, and retention.", "Names follow `<domain>.<entity>`, for example `orders.created`.", "Default retention is 7 days unless you justify more; the Data team must approve the PR."],
    gotcha: "Partition counts can only be increased later, never decreased, so start small." },
  { slug: "howto-canary-deploy", title: "Run a canary deploy", intro: "Canary is the default deploy flow for every service.",
    steps: ["Run `ok canary start <service> --percent 5` to send 5% of traffic to the new version.", "Watch the error rate and latency panels for at least 15 minutes.", "Run `ok canary promote <service>` to finish, or `ok canary abort <service>` to roll back instantly."],
    gotcha: "A canary left running for more than 4 hours is aborted automatically." },
  { slug: "howto-port-forward-staging", title: "Port-forward to a staging service", intro: "Reach a staging service from your laptop without exposing it publicly.",
    steps: ["Run `ok pf staging <service> <local-port>:<remote-port>`, for example `ok pf staging ledger 8071:8071`.", "The service is now reachable at `localhost:<local-port>`.", "Port-forward sessions expire after 8 hours."],
    gotcha: "Production port-forwarding requires a break-glass ticket and is logged." },
  { slug: "howto-write-adr", title: "Write an architecture decision record", intro: "ADRs capture decisions with lasting impact.",
    steps: ["Copy `docs/adr/0000-template.md` to the next sequential number.", "Fill in Context, Decision, Alternatives considered, and Consequences; the alternatives section is mandatory.", "Open a PR; the ADR moves from `Proposed` to `Accepted` when two senior engineers approve."],
    gotcha: "Superseded ADRs are never deleted; add a `Superseded by` line instead." },
  { slug: "howto-file-incident-report", title: "Open an incident", intro: "Incidents are opened from the CLI so the channel and doc are created consistently.",
    steps: ["Run `ok incident new --sev 2 --title \"short title\"`.", "The CLI creates the Slack channel `#inc-<id>` and a postmortem doc from the template.", "Post status updates in the channel at least every 30 minutes for SEV1 and every hour for SEV2."],
    gotcha: "Only the incident commander closes the incident; use `ok incident close <id>`." },
  { slug: "howto-db-read-replica-access", title: "Get read-replica database credentials", intro: "Ad-hoc queries go to the read replica, never the primary.",
    steps: ["Run `keyringctl lease db/<service>/replica --ttl 4h` to get a temporary credential.", "Connect with `psql \"$(keyringctl url db/ledger/replica)\"`.", "The lease expires after the TTL; the maximum TTL is 8 hours."],
    gotcha: "Replica lag can reach a few seconds during migrations; do not use the replica for correctness checks right after a deploy." },
  { slug: "howto-bump-base-image", title: "Bump the base container image", intro: "All services build from a shared base image.",
    steps: ["Edit `BASE_IMAGE_TAG` in `build/base.env`.", "Run `ok build --no-cache` locally to make sure the new base builds.", "Harbor mirrors the new tag within 10 minutes of the upstream push."],
    gotcha: "Base image bumps that change the glibc version need a note in the release channel." },
  { slug: "howto-configure-ok-cli", title: "Install and configure the ok CLI", intro: "`ok` is the entry point for deploys, incidents, and port-forwarding.",
    steps: ["Install with `brew install example/tap/ok`.", "Run `ok login` to authenticate with SSO.", "Set `default_env = \"staging\"` in `~/.config/ok/config.toml` so commands target staging unless you say otherwise."],
    gotcha: "`ok` refuses to run production commands unless `default_env` is set explicitly or `--env prod` is passed." },
  { slug: "howto-add-grafana-dashboard", title: "Add a Grafana dashboard", intro: "Dashboards are provisioned from the repo, not edited in the UI.",
    steps: ["Add the dashboard JSON under `infra/grafana/dashboards/<team>/`.", "Run `ok grafana lint` to catch missing datasource variables.", "Merge; the dashboard is provisioned within 5 minutes."],
    gotcha: "Edits made in the Grafana UI are overwritten on the next provisioning run." },
  { slug: "howto-profile-go-service", title: "Profile a Go service", intro: "Every Go service can expose pprof on a separate port.",
    steps: ["Set `PPROF_ADDR=:6060` on the pod and restart it.", "Collect a CPU profile with `go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30`.", "Open a flame graph with `go tool pprof -http=:8081 <profile-file>`."],
    gotcha: "Do not leave `PPROF_ADDR` set in production for more than the profiling session." },
  { slug: "howto-reset-stuck-tempo-job", title: "Reset a stuck Tempo job", intro: "Runs occasionally hang on an external dependency.",
    steps: ["Find the run with `tempoctl runs --job <name> --state RUNNING`.", "Kill it with `tempoctl kill <run-id>`.", "Re-run immediately with `tempoctl retry <run-id>` instead of waiting for the next schedule."],
    gotcha: "Killing a run does not roll back partial writes; check the job's idempotency notes first." },
  { slug: "howto-test-webhooks-locally", title: "Test Relay webhooks locally", intro: "Receive real webhook deliveries on your laptop.",
    steps: ["Run `relayctl tunnel --port 3000` to get a temporary public URL that forwards to your local server.", "Emit a sample event with `relayctl emit order.created --endpoint <url>`.", "Verify the signature with `relayctl verify --secret <signing-secret> --body payload.json --signature <header-value>`."],
    gotcha: "Tunnel URLs expire after 2 hours." },
  { slug: "howto-render-pdf-locally", title: "Render a PDF with Quill locally", intro: "Useful for iterating on invoice templates.",
    steps: ["Run `docker run -p 8090:8090 harbor.internal/quill:latest`.", "POST to `http://localhost:8090/render` with a JSON body `{\"markdown\": \"# Hello\"}`.", "Add `?paper=A4` to the URL for A4 output; the default is Letter."],
    gotcha: "The local image ships only Inter and JetBrains Mono; other fonts fall back to Inter." },
  { slug: "howto-reindex-atlas", title: "Reindex Atlas", intro: "Rebuild the search index when it is behind or corrupt.",
    steps: ["For a small lag, run `atlasctl reindex --since 24h`.", "For a corrupt index, run `atlasctl reindex --full`; expect about 25 minutes.", "Confirm recovery by watching `atlas_index_lag_seconds` drop to zero."],
    gotcha: "A full reindex doubles Elasticsearch disk usage while it runs." },
  { slug: "howto-book-conference-room", title: "Book a conference room", intro: "Rooms are booked from the calendar; a few have special equipment.",
    steps: ["Add the room as an attendee in the calendar invite.", "`Osprey` seats 8 on the 4th floor and has the video conferencing unit; `Kestrel` seats 4 on the 2nd floor.", "Bookings during 09:00-17:00 are limited to 2 hours."],
    gotcha: "Recurring bookings are released automatically if the room is empty 15 minutes after the start time." },
];

for (const h of howtos) {
  notes.push({
    slug: h.slug,
    body: `# ${h.title}

${h.intro}

## Steps

${h.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Gotchas

${h.gotcha}
`,
  });
}

// ---------------------------------------------------------------- policies
notes.push({
  slug: "policy-oncall",
  body: `# On-call policy

Every service team runs a weekly on-call rotation with a primary and a secondary. The rotation is managed in Sentinel.

## Rotation

Shifts run for one week and hand over on Tuesday at 10:00 local time. The secondary shadows the primary and takes over when the primary does not acknowledge a page within 15 minutes.

## Expectations

The primary must acknowledge high-severity pages within 10 minutes and be within reach of a laptop for the whole shift. Low-severity pages are held during quiet hours and delivered at 09:00.

## Compensation

Engineers receive one day off in lieu for each week of primary on-call, to be taken within the following quarter.
`,
});
notes.push({
  slug: "policy-incident-severity",
  body: `# Incident severity levels

Severity determines who is paged, how often status is posted, and when the postmortem is due.

## SEV1

Customer-facing outage or data loss. Page immediately regardless of quiet hours, post status updates every 30 minutes, and send an executive summary when resolved. The postmortem is due within 5 business days.

## SEV2

Degraded service with a workaround. Page during business hours, post status updates every hour. The postmortem is due within 10 business days.

## SEV3

Minor impact or internal-only. No page; open a ticket and fix in the normal sprint. No postmortem is required, though a short summary in the ticket is encouraged.
`,
});
notes.push({
  slug: "policy-code-review",
  body: `# Code review guidelines

Every change to a production repository goes through a pull request.

## Approvals

At least one approval from a listed code owner is required. Documentation-only changes may be self-merged after CI passes; everything else needs a second person.

## Size and turnaround

Pull requests over 400 changed lines should be split unless they are generated code. Reviewers are expected to respond within one business day; if you cannot, say so on the PR so the author can find someone else.

## What to look for

Correctness first, then tests, then readability. Style nits should be left as suggestions, not blockers, because the formatter already enforces layout.
`,
});
notes.push({
  slug: "policy-expenses",
  body: `# Expense policy

Business expenses are reimbursed through the expenses portal.

## Submission

Submit expenses within 30 days of the purchase date. Receipts are required for anything over $25. Expenses over $500 need manager approval before purchase, not after.

## Travel

Meals while travelling are capped at $60 per day. Book flights and hotels through the travel tool so the company rate applies; economy class for flights under 6 hours.
`,
});
notes.push({
  slug: "onboarding-checklist",
  body: `# Engineering onboarding checklist

What every new engineer should get done in the first two weeks.

## Day one

Collect your laptop, set up the VPN with the \`tunnel\` client, install the \`ok\` CLI, and confirm you can reach \`harbor.internal\`. Your onboarding buddy is listed in your welcome email.

## First week

Open and merge your first pull request (the team keeps a list of starter tasks), read the on-call policy, and shadow one on-call handover on Tuesday.

## Second week

Deploy a change to staging with the canary flow, add yourself to the team's Sentinel rotation as a shadow, and book a 30-minute intro with each team you depend on.
`,
});

// ---------------------------------------------------------------- write
const dir = join(process.cwd(), "notes");
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith(".md")) unlinkSync(join(dir, f));
for (const n of notes) writeFileSync(join(dir, `${n.slug}.md`), n.body);
console.log(`wrote ${notes.length} notes to ${dir}`);
