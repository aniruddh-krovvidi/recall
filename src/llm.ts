// Answer generation behind a small provider interface. Two implementations:
//  - anthropic: Claude via the official SDK (needs ANTHROPIC_API_KEY)
//  - extractive: deterministic, offline; picks the sentences from the
//    retrieved chunks that best overlap the question and cites them.
// The extractive provider is what CI and the eval harness run.
import Anthropic from "@anthropic-ai/sdk";
import type { Hit } from "./db.ts";

export type Answer = {
  text: string;
  citations: string[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type Provider = {
  name: string;
  answer(question: string, chunks: Hit[]): Promise<Answer>;
};

export const CITATION_RE = /\[([a-z0-9-]+#[a-z0-9~-]+)\]/g;

export function parseCitations(text: string): string[] {
  return [...new Set([...text.matchAll(CITATION_RE)].map((m) => m[1]!))];
}

// ---------------------------------------------------------------- extractive
const STOP = new Set("a an the of to in on for is are was were be by with and or how what when where which who why do does did i my me it its this that at as from into can should".split(" "));

export function terms(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9._$%/-]*/g) ?? [])]
    .filter((w) => w.length > 1 && !STOP.has(w));
}

// Crude stemming: two terms match if one is a prefix of the other after 4 chars.
function matches(qt: string, st: string): boolean {
  if (qt === st) return true;
  const n = Math.min(qt.length, st.length, 5);
  return n >= 4 && qt.slice(0, n) === st.slice(0, n);
}

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export const extractive: Provider = {
  name: "extractive",
  async answer(question, chunks) {
    const q = terms(question);
    type Cand = { chunk: Hit; order: number; sentence: string; score: number };
    const cands: Cand[] = [];
    chunks.forEach((chunk, rank) => {
      const body = chunk.content.split("\n").slice(1).join("\n"); // drop the title line
      const sentences = body.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 20);
      sentences.forEach((sentence, order) => {
        const st = terms(sentence);
        const overlap = q.filter((qt) => st.some((s) => matches(qt, s))).length;
        // Rank bonus breaks ties toward higher-ranked chunks.
        cands.push({ chunk, order, sentence, score: overlap + 0.5 / (rank + 1) });
      });
    });
    let picked = cands.filter((c) => c.score >= 1).sort((a, b) => b.score - a.score).slice(0, 3);
    if (picked.length === 0 && cands.length) picked = cands.filter((c) => c.chunk === chunks[0]).slice(0, 2);
    // Restore document order within the selection so the answer reads naturally.
    picked.sort((a, b) => chunks.indexOf(a.chunk) - chunks.indexOf(b.chunk) || a.order - b.order);
    const text = picked.map((c) => `${c.sentence} [${c.chunk.id}]`).join(" ");
    const prompt = question + chunks.map((c) => c.content).join("\n");
    return { text, citations: parseCitations(text), inputTokens: approxTokens(prompt), outputTokens: approxTokens(text), costUsd: 0 };
  },
};

// ---------------------------------------------------------------- anthropic
const CLAUDE_MODEL = "claude-sonnet-5";
const PRICE_PER_MTOK = { input: 2, output: 10 }; // USD, claude-sonnet-5

const SYSTEM = `You answer questions from a personal knowledge base. Use only the notes provided.
After every claim, cite the chunk it came from as [chunk-id], e.g. [ledger#runbook].
Be brief: one to three sentences. If the notes do not contain the answer, reply exactly: I don't know.`;

export function anthropic(): Provider {
  const client = new Anthropic();
  return {
    name: CLAUDE_MODEL,
    async answer(question, chunks) {
      const notes = chunks.map((c) => `<chunk id="${c.id}">\n${c.content}\n</chunk>`).join("\n");
      const res = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: `${notes}\n\nQuestion: ${question}` }],
      });
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      const inputTokens = res.usage.input_tokens;
      const outputTokens = res.usage.output_tokens;
      const costUsd = (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1e6;
      return { text, citations: parseCitations(text), inputTokens, outputTokens, costUsd };
    },
  };
}

// Anthropic when a key is configured, otherwise the offline extractive provider.
export function pickProvider(): Provider {
  return process.env.ANTHROPIC_API_KEY ? anthropic() : extractive;
}
