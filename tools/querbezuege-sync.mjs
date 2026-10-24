// Kopie der Einträge von cleebration.food / .beer / cars für die Querbezüge im Reise-Atlas.
// Liest die Nachbar-Repos (../cleebration-food, ../cleebration-beer, ../cleebration-cars) und schreibt
// content/querbezuege/<seite>.json. Beim Bauen wird zuerst https://<domain>/atlas-index.json versucht,
// diese Kopie ist der Rückfall (z. B. wenn der Build offline läuft).   Aufruf: node tools/querbezuege-sync.mjs
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const titel = { food: (p) => p.dish && p.dish.de, beer: (p) => p.beer, cars: (p) => p.car && p.car.de };
fs.mkdirSync(path.join(ROOT, "content", "querbezuege"), { recursive: true });
for (const k of Object.keys(titel)) {
  const f = path.join(ROOT, "..", `cleebration-${k}`, "content", "posts.json");
  if (!fs.existsSync(f)) { console.log(`– ${k}: ${f} nicht gefunden`); continue; }
  const posts = JSON.parse(fs.readFileSync(f, "utf8"));
  const out = posts.map((p) => ({ slug: p.slug, date: p.date, titel: titel[k](p) || p.slug, ort: (p.place || {}).de || "", land: (p.country || {}).de || "", lat: p.lat ?? null, lng: p.lng ?? null }));
  fs.writeFileSync(path.join(ROOT, "content", "querbezuege", `${k}.json`), JSON.stringify(out));
  console.log(`✓ ${k}: ${out.length} Einträge`);
}
