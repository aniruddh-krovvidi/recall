import { embedOne } from "./embed.ts";
import { lexicalSearch, vectorSearch, type Db, type Hit } from "./db.ts";
import { rrf } from "./rank.ts";

export type Mode = "vector" | "lexical" | "hybrid";
export const MODES: Mode[] = ["vector", "lexical", "hybrid"];

export type SearchResult = {
  hits: Hit[];
  // Top cosine similarity from the vector retriever. Used as the abstain
  // signal in every mode because RRF and ts_rank scores are not calibrated.
  confidence: number;
};

export async function search(db: Db, query: string, mode: Mode, k: number): Promise<SearchResult> {
  const embedding = await embedOne(query);
  // Retrieve deeper than k before fusing so a hit ranked 8th by one
  // retriever and 3rd by the other can still make the cut.
  const depth = mode === "hybrid" ? k * 2 : k;
  const vec = await vectorSearch(db, embedding, depth);
  const confidence = vec[0]?.score ?? 0;
  let hits: Hit[];
  if (mode === "vector") hits = vec;
  else if (mode === "lexical") hits = await lexicalSearch(db, query, depth);
  else hits = rrf([vec, await lexicalSearch(db, query, depth)]);
  return { hits: hits.slice(0, k), confidence };
}
