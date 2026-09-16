// Evaluation harness. Measures retrieval (Recall@5, MRR@10 for each mode),
// generation (keyword hit rate, citation validity, abstain behaviour) and
// latency, then prints a markdown table and writes a results JSON.
//   node --experimental-strip-types src/eval.ts [out=data/results.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { lexicalSearch, openDb, vectorSearch, type Db, type Hit } from "./db.ts";
import { embedOne } from "./embed.ts";
import { rrf } from "./rank.ts";
import { MODES, type Mode } from "./search.ts";
import { pickProvider } from "./llm.ts";
import { ask } from "./ask.ts";
import { DEFAULT_MIN_CONFIDENCE } from "./guard.ts";

type Question = { id: string; question: string; expected_chunks: string[]; keywords: string[]; abstain?: boolean };
type Review = { id: string; verdict: "pass" | "fail"; reviewer?: string; note?: string };

const K_RECALL = 5;
const K_MRR = 10;

function isExpected(id: string, expected: string[]): boolean {
  return expected.some((e) => id === e || id.startsWith(`${e}~`));
}

export function recallAtK(hits: Hit[], expected: string[], k: number): number {
  return hits.slice(0, k).some((h) => isExpected(h.id, expected)) ? 1 : 0;
}

export function reciprocalRank(hits: Hit[], expected: string[], k: number): number {
  const i = hits.slice(0, k).findIndex((h) => isExpected(h.id, expected));
  return i < 0 ? 0 : 1 / (i + 1);
}

export function keywordHitRate(answer: string, keywords: string[]): number {
  if (keywords.length === 0) return 1;
  const a = answer.toLowerCase();
  return keywords.filter((kw) => a.includes(kw.toLowerCase())).length / keywords.length;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

async function retrieve(db: Db, q: string, mode: Mode, k: number): Promise<Hit[]> {
  const vec = await vectorSearch(db, await embedOne(q), k * 2);
  if (mode === "vector") return vec.slice(0, k);
  const lex = await lexicalSearch(db, q, k * 2);
  return (mode === "lexical" ? lex : rrf([vec, lex])).slice(0, k);
}

export async function runEval(db: Db, questions: Question[], reviews: Review[]) {
  const provider = pickProvider();
  const answerable = questions.filter((q) => !q.abstain);
  const unanswerable = questions.filter((q) => q.abstain);

  // Sanity: expected chunks exist and keywords appear in them. Catches
  // eval-set drift when notes or chunking change.
  const ids = new Set((await db.query<{ id: string }>("SELECT id FROM chunks")).map((r) => r.id));
  for (const q of answerable) {
    for (const e of q.expected_chunks) if (![...ids].some((id) => isExpected(id, [e]))) throw new Error(`${q.id}: expected chunk ${e} not in index`);
  }

  // Retrieval.
  const retrieval: Record<Mode, { recall: number; mrr: number }> = { vector: { recall: 0, mrr: 0 }, lexical: { recall: 0, mrr: 0 }, hybrid: { recall: 0, mrr: 0 } };
  for (const mode of MODES) {
    const rs: number[] = [], ms: number[] = [];
    for (const q of answerable) {
      const hits = await retrieve(db, q.question, mode, K_MRR);
      rs.push(recallAtK(hits, q.expected_chunks, K_RECALL));
      ms.push(reciprocalRank(hits, q.expected_chunks, K_MRR));
    }
    retrieval[mode] = { recall: mean(rs), mrr: mean(ms) };
  }

  // Generation (hybrid, k=5, whichever provider is configured).
  const ctx = { db, provider };
  const perQuestion: Record<string, { keywordHit: number; citationsValid: boolean; abstained: boolean; answer: string; latencyMs: number; confidence: number }> = {};
  const latencies: number[] = [];
  let hit = 0, citeValid = 0, falseAbstain = 0, tokensIn = 0, tokensOut = 0, cost = 0;
  for (const q of answerable) {
    const r = await ask(ctx, q.question, { k: K_RECALL, mode: "hybrid" });
    const kh = r.abstained ? 0 : keywordHitRate(r.answer, q.keywords);
    hit += kh; citeValid += !r.abstained && r.citationsValid ? 1 : 0; falseAbstain += r.abstained ? 1 : 0;
    tokensIn += r.inputTokens; tokensOut += r.outputTokens; cost += r.costUsd; latencies.push(r.latencyMs);
    perQuestion[q.id] = { keywordHit: kh, citationsValid: r.citationsValid, abstained: r.abstained, answer: r.answer, latencyMs: r.latencyMs, confidence: r.confidence };
  }
  let correctAbstain = 0;
  for (const q of unanswerable) {
    const r = await ask(ctx, q.question, { k: K_RECALL, mode: "hybrid" });
    correctAbstain += r.abstained ? 1 : 0; latencies.push(r.latencyMs);
    perQuestion[q.id] = { keywordHit: r.abstained ? 1 : 0, citationsValid: r.citationsValid, abstained: r.abstained, answer: r.answer, latencyMs: r.latencyMs, confidence: r.confidence };
  }

  // Human-in-the-loop: merge reviewer verdicts where present and report how
  // often the automatic keyword judgement agrees with the human one.
  const reviewed = reviews.filter((r) => perQuestion[r.id]);
  const humanPass = reviewed.filter((r) => r.verdict === "pass").length;
  const agree = reviewed.filter((r) => {
    const p = perQuestion[r.id]!;
    const q = questions.find((x) => x.id === r.id)!;
    const autoPass = q.abstain ? p.abstained : !p.abstained && p.keywordHit === 1;
    return autoPass === (r.verdict === "pass");
  }).length;

  const results = {
    ranAt: new Date().toISOString(),
    provider: provider.name,
    minConfidence: DEFAULT_MIN_CONFIDENCE,
    questions: { answerable: answerable.length, unanswerable: unanswerable.length },
    retrieval,
    generation: {
      keywordHitRate: hit / answerable.length,
      citationValidityRate: citeValid / (answerable.length - falseAbstain || 1),
      falseAbstainRate: falseAbstain / answerable.length,
      correctAbstainRate: unanswerable.length ? correctAbstain / unanswerable.length : null,
      tokensIn, tokensOut, costUsd: cost,
    },
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    human: reviewed.length ? { reviewed: reviewed.length, passRate: humanPass / reviewed.length, agreementWithAuto: agree / reviewed.length } : null,
    perQuestion,
  };
  return results;
}

export function table(r: Awaited<ReturnType<typeof runEval>>): string {
  const rows = [
    ["metric", "vector", "lexical", "hybrid"],
    ["---", "---", "---", "---"],
    [`Recall@${K_RECALL}`, ...MODES.map((m) => pct(r.retrieval[m].recall))],
    [`MRR@${K_MRR}`, ...MODES.map((m) => pct(r.retrieval[m].mrr))],
  ];
  const gen = [
    ["metric (hybrid, k=5, provider=" + r.provider + ")", "value"],
    ["---", "---"],
    ["answer keyword hit rate", pct(r.generation.keywordHitRate)],
    ["citation validity rate", pct(r.generation.citationValidityRate)],
    ["false abstain rate (answerable)", pct(r.generation.falseAbstainRate)],
    ["correct abstain rate (out-of-scope)", r.generation.correctAbstainRate == null ? "n/a" : pct(r.generation.correctAbstainRate)],
    ["ask() latency p50 / p95", `${r.latencyMs.p50.toFixed(0)} ms / ${r.latencyMs.p95.toFixed(0)} ms`],
    ["tokens in / out, cost", `${r.generation.tokensIn} / ${r.generation.tokensOut}, $${r.generation.costUsd.toFixed(4)}`],
  ];
  if (r.human) gen.push(["human review pass rate (n=" + r.human.reviewed + ")", pct(r.human.passRate)], ["auto vs human agreement", pct(r.human.agreementWithAuto)]);
  const fmt = (rows: string[][]) => rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${fmt(rows)}\n\n${fmt(gen)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? "data/results.json";
  process.env.RECALL_LOG ??= "data/eval-requests.jsonl";
  const questions: Question[] = JSON.parse(readFileSync("eval/questions.json", "utf8"));
  const reviews: Review[] = existsSync("eval/reviews.jsonl")
    ? readFileSync("eval/reviews.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const db = await openDb(process.env.RECALL_DATA_DIR ?? "data/pg");
  const results = await runEval(db, questions, reviews);
  await db.close();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(table(results));
  const misses = Object.entries(results.perQuestion).filter(([id, p]) => (id.startsWith("n") ? !p.abstained : p.keywordHit < 1));
  if (misses.length) console.log(`\nmisses (${misses.length}):\n` + misses.map(([id, p]) => `  ${id} conf=${p.confidence.toFixed(2)} → ${p.answer.slice(0, 110)}`).join("\n"));
  console.log(`\nwrote ${out}`);
}
