// Reciprocal rank fusion (Cormack et al. 2009): merge ranked lists by
// summing 1/(k + rank). Scores from different retrievers are not comparable,
// ranks are — which is why RRF needs no tuning beyond k.
import type { Hit } from "./db.ts";

export function rrf(lists: Hit[][], k = 60): Hit[] {
  const fused = new Map<string, Hit>();
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const prev = fused.get(hit.id);
      const contribution = 1 / (k + rank + 1);
      if (prev) prev.score += contribution;
      else fused.set(hit.id, { ...hit, score: contribution });
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
