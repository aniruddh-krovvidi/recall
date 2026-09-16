// HTTP API on node:http — no framework.
//   POST /ask     {"question": "...", "k": 5, "mode": "hybrid"}
//   GET  /search?q=...&mode=vector|lexical|hybrid&k=10
//   GET  /metrics (Prometheus text format)
//   GET  /        (the React page in web/)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { openDb } from "./db.ts";
import { pickProvider } from "./llm.ts";
import { ask } from "./ask.ts";
import { MODES, search, type Mode } from "./search.ts";
import { record, render } from "./metrics.ts";

const PORT = Number(process.env.PORT ?? 8080);
const db = await openDb(process.env.RECALL_DATA_DIR ?? "data/pg");
const provider = pickProvider();
const ctx = { db, provider };

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 1e5) reject(new Error("body too large")); });
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}

function parseMode(m: unknown): Mode {
  return MODES.includes(m as Mode) ? (m as Mode) : "hybrid";
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const t0 = performance.now();
  try {
    if (req.method === "POST" && url.pathname === "/ask") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (typeof body.question !== "string" || !body.question.trim()) return json(res, 400, { error: "question is required" });
      const out = await ask(ctx, body.question, { k: Math.min(Number(body.k) || 5, 20), mode: parseMode(body.mode) });
      return json(res, 200, out); // ask() records its own metrics
    }
    if (req.method === "GET" && url.pathname === "/search") {
      const q = url.searchParams.get("q")?.trim();
      if (!q) return json(res, 400, { error: "q is required" });
      const out = await search(db, q, parseMode(url.searchParams.get("mode")), Math.min(Number(url.searchParams.get("k")) || 10, 50));
      record({ ts: new Date().toISOString(), route: "/search", status: 200, latencyMs: performance.now() - t0 });
      return json(res, 200, out);
    }
    if (req.method === "GET" && url.pathname === "/metrics") {
      res.writeHead(200, { "content-type": "text/plain; version=0.0.4" });
      return res.end(render());
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(readFileSync("web/index.html"));
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    record({ ts: new Date().toISOString(), route: url.pathname, status: 500, latencyMs: performance.now() - t0 });
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, () => console.log(`recall listening on :${PORT} (provider=${provider.name})`));
