// Storage: Postgres via PGlite (WASM) with pgvector for similarity and the
// built-in tsvector full-text search for lexical retrieval. Every statement
// here is plain Postgres SQL, so pointing `openDb` at a real Postgres +
// pgvector is a driver swap, not a rewrite.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import type { Chunk } from "./chunk.ts";
import { DIMS } from "./embed.ts";

export type Db = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
};

export type Hit = Chunk & { score: number };

export async function openDb(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(dirname(dataDir), { recursive: true });   // data/ is gitignored; PGlite only creates the leaf
  const pg = await PGlite.create({ dataDir, extensions: { vector } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  return {
    async query<T>(sql: string, params: unknown[] = []) { return (await pg.query<T>(sql, params)).rows; },
    async exec(sql) { await pg.exec(sql); },
    async close() { await pg.close(); },
  };
}

export async function resetSchema(db: Db): Promise<void> {
  await db.exec(`
    DROP TABLE IF EXISTS chunks;
    CREATE TABLE chunks (
      id        text PRIMARY KEY,
      note      text NOT NULL,
      heading   text NOT NULL,
      content   text NOT NULL,
      embedding vector(${DIMS}) NOT NULL,
      tsv       tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
    );
    CREATE INDEX chunks_tsv_idx ON chunks USING gin (tsv);
  `);
}

export async function insertChunks(db: Db, chunks: Chunk[], embeddings: number[][]): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    await db.query(
      "INSERT INTO chunks (id, note, heading, content, embedding) VALUES ($1, $2, $3, $4, $5::vector)",
      [c.id, c.note, c.heading, c.content, JSON.stringify(embeddings[i])],
    );
  }
}

export async function countChunks(db: Db): Promise<number> {
  const [row] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM chunks");
  return row?.n ?? 0;
}

// Cosine similarity via pgvector's `<=>` (cosine distance). Embeddings are
// L2-normalised, so score is in [-1, 1] and comparable across queries.
export async function vectorSearch(db: Db, embedding: number[], k: number): Promise<Hit[]> {
  return db.query<Hit>(
    `SELECT id, note, heading, content, 1 - (embedding <=> $1::vector) AS score
     FROM chunks ORDER BY embedding <=> $1::vector LIMIT $2`,
    [JSON.stringify(embedding), k],
  );
}

// Postgres full-text search. plainto_tsquery stems and strips stop words but
// ANDs every term, which is far too strict for natural-language questions;
// rewriting `&` to `|` gives OR semantics and lets ts_rank_cd order by how
// many query terms a chunk covers and how close together they are.
export async function lexicalSearch(db: Db, query: string, k: number): Promise<Hit[]> {
  return db.query<Hit>(
    `SELECT id, note, heading, content, ts_rank_cd(tsv, t.q) AS score
     FROM chunks, (SELECT replace(plainto_tsquery('english', $1)::text, '&', '|')::tsquery AS q) t
     WHERE tsv @@ t.q ORDER BY score DESC, id LIMIT $2`,
    [query, k],
  );
}
