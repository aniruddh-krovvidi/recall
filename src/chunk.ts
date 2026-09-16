// Markdown → chunks. One chunk per `##` section (the preamble is "intro"),
// split further at paragraph boundaries when a section exceeds maxChars.
// Chunk ids are stable and human-readable: `<note>#<heading>[~n]`.
export type Chunk = { id: string; note: string; heading: string; content: string };

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

export function chunkNote(note: string, markdown: string, maxChars = 900): Chunk[] {
  const lines = markdown.split("\n");
  let title = note;
  const sections: { heading: string; lines: string[] }[] = [{ heading: "intro", lines: [] }];
  for (const line of lines) {
    if (line.startsWith("# ") && title === note) { title = line.slice(2).trim(); continue; }
    if (line.startsWith("## ")) { sections.push({ heading: line.slice(3).trim(), lines: [] }); continue; }
    sections[sections.length - 1]!.lines.push(line);
  }

  const out: Chunk[] = [];
  for (const s of sections) {
    const body = s.lines.join("\n").trim();
    if (!body) continue;
    const prefix = s.heading === "intro" ? title : `${title} › ${s.heading}`;
    const parts = splitParagraphs(body, maxChars - prefix.length - 2);
    parts.forEach((p, i) => {
      const base = `${note}#${slugify(s.heading)}`;
      out.push({ id: i === 0 ? base : `${base}~${i + 1}`, note, heading: s.heading, content: `${prefix}\n${p}` });
    });
  }
  return out;
}

// Greedy paragraph packing; a single oversized paragraph is emitted as-is.
function splitParagraphs(text: string, maxChars: number): string[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const parts: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > maxChars) { parts.push(cur); cur = p; }
    else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) parts.push(cur);
  return parts;
}
