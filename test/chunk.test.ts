import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkNote, slugify } from "../src/chunk.ts";

const md = `# Ledger — accounting

Intro paragraph.

## Architecture

Two tables.

## Runbook

First step.
`;

test("one chunk per section with stable ids", () => {
  const chunks = chunkNote("ledger", md);
  assert.deepEqual(chunks.map((c) => c.id), ["ledger#intro", "ledger#architecture", "ledger#runbook"]);
  assert.equal(chunks[0]!.content, "Ledger — accounting\nIntro paragraph.");
  assert.equal(chunks[1]!.content, "Ledger — accounting › Architecture\nTwo tables.");
  assert.equal(chunks[2]!.heading, "Runbook");
});

test("oversized sections split at paragraph boundaries", () => {
  const paras = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ${"x".repeat(120)}.`).join("\n\n");
  const chunks = chunkNote("n", `# T\n\n## Long\n\n${paras}\n`, 300);
  assert.ok(chunks.length > 1);
  assert.deepEqual(chunks.map((c) => c.id).slice(0, 2), ["n#long", "n#long~2"]);
  for (const c of chunks) assert.ok(c.content.length <= 300, `chunk too long: ${c.content.length}`);
  assert.ok(chunks.every((c) => c.content.startsWith("T › Long\n")));
});

test("empty sections are skipped and headings slugified", () => {
  const chunks = chunkNote("n", "# T\n\n## Empty\n\n## SEV1 / Day one!\n\nbody\n");
  assert.deepEqual(chunks.map((c) => c.id), ["n#sev1-day-one"]);
  assert.equal(slugify("  Size & turnaround "), "size-turnaround");
});
