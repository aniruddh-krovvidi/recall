// Ingest a folder of markdown notes: chunk → embed → store.
//   node --experimental-strip-types src/ingest.ts [notesDir] [dataDir]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkNote, type Chunk } from "./chunk.ts";
import { embed } from "./embed.ts";
import { countChunks, insertChunks, openDb, resetSchema, type Db } from "./db.ts";

export function loadNotes(dir: string): { note: string; markdown: string }[] {
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
    .map((f) => ({ note: f.replace(/\.md$/, ""), markdown: readFileSync(join(dir, f), "utf8") }));
}

export async function ingest(db: Db, notesDir: string): Promise<{ notes: number; chunks: Chunk[] }> {
  const notes = loadNotes(notesDir);
  const chunks = notes.flatMap((n) => chunkNote(n.note, n.markdown));
  const embeddings = await embed(chunks.map((c) => c.content));
  await resetSchema(db);
  await insertChunks(db, chunks, embeddings);
  return { notes: notes.length, chunks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const notesDir = process.argv[2] ?? "notes";
  const dataDir = process.argv[3] ?? process.env.RECALL_DATA_DIR ?? "data/pg";
  const t0 = performance.now();
  const db = await openDb(dataDir);
  const { notes, chunks } = await ingest(db, notesDir);
  const n = await countChunks(db);
  await db.close();
  console.log(`ingested ${notes} notes → ${chunks.length} chunks (${n} stored) in ${Math.round(performance.now() - t0)}ms → ${dataDir}`);
}
