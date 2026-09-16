import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCitations, shouldAbstain } from "../src/guard.ts";
import { parseCitations } from "../src/llm.ts";

test("citations must all come from the retrieved set", () => {
  const retrieved = ["ledger#runbook", "ledger#configuration"];
  assert.deepEqual(checkCitations(["ledger#runbook"], retrieved), { valid: true, invalid: [] });
  assert.deepEqual(checkCitations(["ledger#runbook", "beacon#intro"], retrieved), { valid: false, invalid: ["beacon#intro"] });
});

test("an answer with no citations is not valid", () => {
  assert.equal(checkCitations([], ["ledger#runbook"]).valid, false);
});

test("parseCitations finds bracketed chunk ids and dedupes", () => {
  const ids = parseCitations("Port 8071 [ledger#configuration]. Deploys Tue/Thu [ledger#configuration]; see [howto-canary-deploy#steps~2].");
  assert.deepEqual(ids, ["ledger#configuration", "howto-canary-deploy#steps~2"]);
  assert.deepEqual(parseCitations("[not a chunk] [1]"), []);
});

test("abstain below the confidence threshold", () => {
  assert.equal(shouldAbstain(0.2, 0.35), true);
  assert.equal(shouldAbstain(0.35, 0.35), false);
  assert.equal(shouldAbstain(0.8, 0.35), false);
});
