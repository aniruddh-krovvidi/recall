// The /ask pipeline: retrieve → abstain check → generate → citation check → log.
import type { Db, Hit } from "./db.ts";
import type { Provider } from "./llm.ts";
import { search, type Mode } from "./search.ts";
import { ABSTAIN_TEXT, checkCitations, DEFAULT_MIN_CONFIDENCE, shouldAbstain } from "./guard.ts";
import { record } from "./metrics.ts";

export type AskContext = { db: Db; provider: Provider; minConfidence?: number };

export type AskResult = {
  question: string;
  mode: Mode;
  answer: string;
  abstained: boolean;
  confidence: number;
  citations: string[];
  citationsValid: boolean;
  invalidCitations: string[];
  sources: Hit[];
  provider: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export async function ask(ctx: AskContext, question: string, opts: { k?: number; mode?: Mode } = {}): Promise<AskResult> {
  const k = opts.k ?? 5;
  const mode = opts.mode ?? "hybrid";
  const t0 = performance.now();
  const { hits, confidence } = await search(ctx.db, question, mode, k);

  let result: AskResult;
  if (shouldAbstain(confidence, ctx.minConfidence ?? DEFAULT_MIN_CONFIDENCE)) {
    result = {
      question, mode, answer: ABSTAIN_TEXT, abstained: true, confidence, citations: [], citationsValid: true,
      invalidCitations: [], sources: hits, provider: ctx.provider.name, latencyMs: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
    };
  } else {
    const a = await ctx.provider.answer(question, hits);
    const check = checkCitations(a.citations, hits.map((h) => h.id));
    result = {
      question, mode, answer: a.text, abstained: false, confidence, citations: a.citations.filter((c) => !check.invalid.includes(c)),
      citationsValid: check.valid, invalidCitations: check.invalid, sources: hits.filter((h) => a.citations.includes(h.id)),
      provider: ctx.provider.name, latencyMs: 0, inputTokens: a.inputTokens, outputTokens: a.outputTokens, costUsd: a.costUsd,
    };
  }
  result.latencyMs = Math.round((performance.now() - t0) * 10) / 10;
  record({
    ts: new Date().toISOString(), route: "/ask", status: 200, latencyMs: result.latencyMs, mode, provider: result.provider,
    abstained: result.abstained, citationsValid: result.citationsValid, inputTokens: result.inputTokens,
    outputTokens: result.outputTokens, costUsd: result.costUsd, question,
  });
  return result;
}
