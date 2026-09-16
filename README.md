# recall

Semantic search and question answering over a folder of markdown notes, with
an **evaluation harness** that measures retrieval quality, answer quality,
abstain behaviour and latency on every CI run. TypeScript on Node, Postgres
(via PGlite + pgvector), local embeddings — no API key or external service
needed to run the whole pipeline, including the evals.

```
notes/*.md ──► chunk ──► embed (MiniLM, local) ──► Postgres: pgvector + tsvector
                                                        │
POST /ask ──► embed query ──► vector search ─┐          │
                              lexical search ─┴─► RRF ──┘──► confidence check
                                                              │ low → abstain
                                                              ▼
                              LLM provider (Claude, or offline extractive) ──► answer
                                                              │
                              citation guardrail ──► JSONL request log ──► /metrics
```

- **Three retrievers, one ranker** — pgvector cosine similarity, Postgres
  full-text search (`tsvector`/`ts_rank_cd`), and a hybrid that fuses both
  with reciprocal rank fusion. The eval reports all three side by side.
- **Runs offline** — embeddings via transformers.js (`Xenova/all-MiniLM-L6-v2`,
  23 MB, downloaded once); Postgres is PGlite (WASM) so there is nothing to
  install. The `extractive` answer provider needs no API; set
  `ANTHROPIC_API_KEY` and `claude-sonnet-5` is used instead.
- **Guardrails + accounting** — answers may only cite chunks that were
  actually retrieved; low-confidence retrieval abstains instead of guessing;
  every request logs latency, tokens and cost to JSON lines and to a
  Prometheus `/metrics` endpoint.
- **No framework** — `node:http`, `node:test`, ~700 lines of TypeScript run
  directly by Node's type stripping (no build step).

## Evaluation

71 synthetic notes (project docs, weekly meeting notes, how-tos, policies —
all invented) → 229 chunks. 48 questions with expected source chunks and
answer keywords, plus 5 out-of-scope questions that should be refused.
MacBook Pro (M4 Max), extractive provider, `npm run eval`:

| metric                               | vector | lexical | hybrid      |
|--------------------------------------|-------:|--------:|------------:|
| Recall@5                             |  95.8% |   97.9% | **100.0%**  |
| MRR@10                               |  83.1% |   80.6% | **87.2%**   |
| answer keyword hit rate              |      – |       – | 93.8%       |
| citation validity rate               |      – |       – | 100.0%      |
| false abstain rate (48 answerable)   |      – |       – | 0.0%        |
| correct abstain rate (5 out-of-scope)|      – |       – | 60.0%       |
| `ask()` latency p50 / p95            |      – |       – | 3 ms / 3 ms |
| human review pass rate (n=15)        |      – |       – | 66.7%       |

Generation metrics are for hybrid retrieval, k=5. What the numbers say:

- **Hybrid beats either retriever alone.** Vector search misses questions
  that hinge on an exact identifier; lexical search misses paraphrases
  ("package manager … moving to" vs. "adopt pnpm"). RRF gets both. Lexical
  only reaches 97.9% after switching the Postgres query from AND to OR
  semantics — with `plainto_tsquery`'s default AND it scored 33.3%.
- **The extractive provider's misses are morphology, not retrieval.** All
  three keyword misses had the right chunk in the top 5; the sentence picker
  failed to match "owns" ↔ "Owner:" and "naming" ↔ "Names". That is exactly
  the gap an LLM provider closes, and why generation sits behind an
  interface.
- **The abstain threshold is a real trade-off.** At the default cosine cutoff
  of 0.35 no answerable question is refused, but 2 of 5 out-of-scope
  questions get a confident-sounding wrong answer (confidence 0.41 and 0.35).
  Raising it to 0.42 refuses all 5 at the cost of one false abstain (q06, at
  0.37). `RECALL_MIN_CONFIDENCE` is the knob; the harness reports both sides
  so the choice is measured, not guessed.
- **Keyword hit rate is a proxy.** `eval/reviews.jsonl` holds 15 hand
  judgments; the harness merges them in and reports pass rate and agreement
  with the automatic metric (100% here, but the human file also records
  *why* answers pass or fail — padding sentences, a confusing extra SEV2
  line — which no keyword catches).

Latency is embedding + two SQL queries + sentence extraction; the first
request after start-up takes ~70 ms while the model loads. Ingest of all 71
notes takes ~1.6 s including model load.

## Run it

```bash
npm ci
npm run ingest                 # notes/ → data/pg (downloads the 23 MB model once)
npm run serve                  # http://localhost:8080  (UI at /, API below)
npm run eval                   # prints the table above, writes data/results.json
npm test                       # 14 tests: chunking, RRF, guardrails, end-to-end ask()
npm run gen-notes              # regenerate the synthetic knowledge base
```

Point it at your own notes: `node --experimental-strip-types src/ingest.ts ~/notes`.
Use Claude for answers: `ANTHROPIC_API_KEY=... npm run serve` (not exercised
in this repo's numbers — everything above ran with the offline provider).

## API

```bash
curl -s localhost:8080/ask -d '{"question":"When does Harbor garbage collection run?"}'
```

```json
{
  "answer": "Garbage collection runs every Sunday at 02:00 UTC and deletes blobs not pulled within the minimum age. [harbor#configuration] ...",
  "abstained": false,
  "confidence": 0.8,
  "citations": ["harbor#configuration", "meeting-sre-2026-07-13#decisions"],
  "citationsValid": true,
  "sources": [{ "id": "harbor#configuration", "note": "harbor", "heading": "Configuration", "content": "..." }],
  "provider": "extractive",
  "latencyMs": 3.2,
  "inputTokens": 353, "outputTokens": 104, "costUsd": 0
}
```

- `POST /ask` — `{"question", "k"?: 5, "mode"?: "hybrid" | "vector" | "lexical"}`
- `GET /search?q=...&mode=hybrid&k=10` — ranked chunks and the confidence score
- `GET /metrics` — request/abstain/invalid-citation counters, token and cost
  totals, latency histogram (Prometheus text format)
- `GET /` — a one-component React page that calls `/ask` and shows the answer
  with its cited sources (React from a CDN, no build step)

## Design notes

- **Chunking** (`src/chunk.ts`): one chunk per `##` section, prefixed with
  the note title so "Configuration" chunks from twelve services embed
  differently. Ids are readable (`ledger#runbook`) so citations mean
  something to a person, and stable so the eval set survives re-ingests.
- **Storage** (`src/db.ts`): plain Postgres SQL — `vector(384)` column with
  the `<=>` cosine operator, a generated `tsvector` column with a GIN index.
  PGlite runs it in-process; swapping in real Postgres + pgvector is a driver
  change in `openDb`, not a schema or query change.
- **Hybrid ranking** (`src/rank.ts`): reciprocal rank fusion with k=60. Scores
  from cosine and `ts_rank_cd` are on different scales; ranks are not.
- **Abstain signal** (`src/search.ts`): top cosine similarity from the vector
  retriever, in every mode, because RRF and ts_rank scores are not calibrated
  across queries.
- **Providers** (`src/llm.ts`): `Provider.answer(question, chunks)` returns
  text, citations, token counts and cost. `extractive` is deterministic and
  free, so CI and tests are hermetic; `anthropic` uses the official SDK and
  prices `claude-sonnet-5` usage from the response's `usage` block.
- **Guardrails** (`src/guard.ts`): a citation is valid only if it names a
  retrieved chunk; invalid ones are stripped, counted, and surfaced in the
  response. Abstaining returns a fixed string and no citations.
- **Eval** (`src/eval.ts`): Recall@5 and MRR@10 per retriever; keyword hit
  rate, citation validity, false/correct abstain rates and p50/p95 for the
  full `ask()` path; optional merge of human judgments from
  `eval/reviews.jsonl`. It also asserts every expected chunk id exists, so
  changing chunking or notes without updating the eval set fails CI.

## Files

- `src/chunk.ts`, `src/embed.ts`, `src/db.ts`, `src/rank.ts`, `src/search.ts` — ingest and retrieval
- `src/llm.ts`, `src/guard.ts`, `src/ask.ts` — generation, guardrails, the `/ask` pipeline
- `src/metrics.ts`, `src/server.ts`, `web/index.html` — accounting, HTTP API, UI
- `src/ingest.ts`, `src/eval.ts` — CLIs
- `eval/questions.json`, `eval/reviews.jsonl` — the eval set and human judgments
- `scripts/gen-notes.ts`, `notes/` — synthetic knowledge base and its generator
- `test/` — `node:test` suites; `.github/workflows/ci.yml` — typecheck, tests, eval on Node 22

## Deliberate simplifications

- Vector search is a brute-force scan; at 229 chunks it is faster than an
  HNSW index would be. Add `CREATE INDEX ... USING hnsw` past ~50k chunks.
- Ingest is full-refresh (drop and rebuild). Incremental ingest keyed on a
  content hash per chunk is the next step for a knowledge base that changes.
- The extractive provider is a term-overlap sentence picker with 5-character
  prefix stemming. It exists to make evals and CI free and deterministic, not
  to compete with an LLM — the eval shows where it falls short.
- The abstain threshold was chosen from one eval run of 5 out-of-scope
  questions. A real deployment needs a larger negative set and should log
  confidence per request (it does) to re-tune it from production traffic.
- Metrics live in process memory and reset on restart; the JSONL log is the
  durable record. Scraping `/metrics` into Prometheus is the intended path.
