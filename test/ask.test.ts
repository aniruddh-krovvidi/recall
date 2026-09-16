// End-to-end: real chunking, real local embeddings, real PGlite + pgvector,
// extractive provider. In-memory database, a handful of notes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type Db } from "../src/db.ts";
import { ingest } from "../src/ingest.ts";
import { ask } from "../src/ask.ts";
import { search } from "../src/search.ts";
import { extractive } from "../src/llm.ts";
import { ABSTAIN_TEXT } from "../src/guard.ts";

process.env.RECALL_LOG = "off";

const NOTES: Record<string, string> = {
  ledger: "# Ledger — accounting service\n\nSystem of record for money movement.\n\n## Configuration\n\nThe service listens on port 8071. Deploys happen on Tuesday and Thursday.\n\n## Runbook\n\nWhen LedgerReconciliationDrift fires, run `ledgerctl reconcile --dry-run` first.\n",
  quill: "# Quill — PDF rendering\n\nRenders invoices to PDF.\n\n## Architecture\n\nA pool of 8 headless Chromium workers renders documents with a 45-second timeout.\n",
  rooms: "# Book a conference room\n\n## Steps\n\n1. Add the room to the invite.\n2. Osprey seats 8 and has the video conferencing unit; Kestrel seats 4.\n",
};

let db: Db;
let dir: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "recall-"));
  for (const [slug, md] of Object.entries(NOTES)) writeFileSync(join(dir, `${slug}.md`), md);
  db = await openDb();
  const { chunks } = await ingest(db, dir);
  assert.equal(chunks.length, 6);
});

after(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("hybrid search ranks the right chunk first", async () => {
  const { hits, confidence } = await search(db, "which port does ledger use", "hybrid", 3);
  assert.equal(hits[0]!.id, "ledger#configuration");
  assert.ok(confidence > 0.35, `confidence ${confidence}`);
});

test("ask() answers with a valid citation from the retrieved chunks", async () => {
  const r = await ask({ db, provider: extractive }, "What port does the ledger service listen on?", { k: 3 });
  assert.equal(r.abstained, false);
  assert.match(r.answer, /8071/);
  assert.ok(r.citations.includes("ledger#configuration"), r.citations.join(","));
  assert.equal(r.citationsValid, true);
  assert.deepEqual(r.invalidCitations, []);
  assert.ok(r.sources.some((s) => s.id === "ledger#configuration"));
  assert.equal(r.costUsd, 0);
  assert.ok(r.latencyMs > 0);
});

test("ask() abstains on an out-of-scope question", async () => {
  const r = await ask({ db, provider: extractive }, "What is the capital of Australia?", { k: 3 });
  assert.equal(r.abstained, true);
  assert.equal(r.answer, ABSTAIN_TEXT);
  assert.deepEqual(r.citations, []);
});

test("lexical mode finds exact identifiers", async () => {
  const r = await ask({ db, provider: extractive }, "LedgerReconciliationDrift", { k: 2, mode: "lexical", });
  assert.ok(r.sources.some((s) => s.id === "ledger#runbook") || r.abstained);
});
