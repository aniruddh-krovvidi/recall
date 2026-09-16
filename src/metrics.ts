// Per-request accounting: a JSON-lines log for offline analysis and
// in-memory counters/histograms rendered in Prometheus text format.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type RequestRecord = {
  ts: string;
  route: string;
  status: number;
  latencyMs: number;
  mode?: string;
  provider?: string;
  abstained?: boolean;
  citationsValid?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  question?: string;
};

const BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

const counters = new Map<string, number>();
const hist = { buckets: new Array<number>(BUCKETS_MS.length).fill(0), sum: 0, count: 0 };

function inc(name: string, labels: Record<string, string | number | boolean> = {}, by = 1): void {
  const key = name + "{" + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",") + "}";
  counters.set(key, (counters.get(key) ?? 0) + by);
}

export function record(r: RequestRecord): void {
  inc("recall_requests_total", { route: r.route, status: r.status });
  BUCKETS_MS.forEach((b, i) => { if (r.latencyMs <= b) hist.buckets[i]!++; });
  hist.sum += r.latencyMs;
  hist.count++;
  if (r.abstained) inc("recall_abstain_total", { route: r.route });
  if (r.citationsValid === false) inc("recall_citation_invalid_total", { route: r.route });
  if (r.inputTokens) inc("recall_tokens_total", { kind: "input" }, r.inputTokens);
  if (r.outputTokens) inc("recall_tokens_total", { kind: "output" }, r.outputTokens);
  if (r.costUsd) inc("recall_cost_usd_total", {}, r.costUsd);

  const path = process.env.RECALL_LOG ?? "data/requests.jsonl";
  if (path !== "off") {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(r) + "\n");
  }
}

export function render(): string {
  const lines: string[] = [];
  lines.push("# TYPE recall_requests_total counter", "# TYPE recall_abstain_total counter",
    "# TYPE recall_citation_invalid_total counter", "# TYPE recall_tokens_total counter", "# TYPE recall_cost_usd_total counter");
  for (const [k, v] of [...counters].sort()) lines.push(`${k.replace("{}", "")} ${v}`);
  lines.push("# TYPE recall_request_latency_ms histogram");
  BUCKETS_MS.forEach((b, i) => lines.push(`recall_request_latency_ms_bucket{le="${b}"} ${hist.buckets[i]}`));
  lines.push(`recall_request_latency_ms_bucket{le="+Inf"} ${hist.count}`);
  lines.push(`recall_request_latency_ms_sum ${hist.sum}`, `recall_request_latency_ms_count ${hist.count}`);
  return lines.join("\n") + "\n";
}
