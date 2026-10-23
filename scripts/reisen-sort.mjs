// Reisen nach Startdatum sortieren: neueste zuerst (aus content/reisen/<slug>/_atlas.json, tage[0].datum).
// Reisen ohne Datum behalten ihre Reihenfolge aus reisen.json und kommen ans Ende.
import fs from "node:fs";
import path from "node:path";

export function startDatum(ROOT, slug) {
  try {
    const a = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "reisen", slug, "_atlas.json"), "utf8"));
    return (a.tage || []).map((t) => t.datum).filter(Boolean).sort()[0] || "";
  } catch {
    return "";
  }
}

export function neuesteZuerst(ROOT, trips) {
  return trips
    .map((t, i) => ({ t, i, d: startDatum(ROOT, t.slug) }))
    .sort((a, b) => (a.d && b.d ? b.d.localeCompare(a.d) : a.d ? -1 : b.d ? 1 : a.i - b.i))
    .map((x) => x.t);
}
