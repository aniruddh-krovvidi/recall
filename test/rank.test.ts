import { test } from "node:test";
import assert from "node:assert/strict";
import { rrf } from "../src/rank.ts";
import type { Hit } from "../src/db.ts";

const hit = (id: string, score = 0): Hit => ({ id, note: id, heading: "", content: "", score });

test("rrf rewards items ranked well by both lists", () => {
  const vec = [hit("a", 0.9), hit("b", 0.8), hit("c", 0.7)];
  const lex = [hit("b", 3.0), hit("c", 2.0), hit("d", 1.0)];
  const fused = rrf([vec, lex]);
  // b is 2nd and 1st; a is 1st in one list only; d is 3rd in one list only.
  assert.deepEqual(fused.map((h) => h.id), ["b", "c", "a", "d"]);
  assert.deepEqual(fused.map((h) => h.id).sort(), ["a", "b", "c", "d"]);
  assert.ok(fused[0]!.score > fused[fused.length - 1]!.score);
});

test("rrf ignores raw scores and only uses rank", () => {
  const big = [hit("x", 1000), hit("y", 999)];
  const small = [hit("y", 0.02), hit("x", 0.01)];
  const fused = rrf([big, small]);
  assert.ok(Math.abs(fused[0]!.score - fused[1]!.score) < 1e-12);
});

test("rrf with k=60 matches the textbook formula", () => {
  const fused = rrf([[hit("a")], [hit("b"), hit("a")]]);
  const a = fused.find((h) => h.id === "a")!;
  assert.ok(Math.abs(a.score - (1 / 61 + 1 / 62)) < 1e-12);
  assert.equal(fused[0]!.id, "a");
});
