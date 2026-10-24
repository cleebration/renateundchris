// Querbezüge: Einträge von cleebration.food, cleebration.beer und cars.cleebration.com, die zu einem Reisetag passen.
//
// Quelle je Seite: live https://<domain>/atlas-index.json (schreibt der Build der jeweiligen Seite),
// sonst die Kopie content/querbezuege/<seite>.json (tools/querbezuege-sync.mjs aus den Nachbar-Repos).
// Passend ist ein Eintrag, wenn er am selben Tag entstand (Datum gleich) oder höchstens 8 km von einer Station
// des Tages entfernt ist (dann „früher/später hier“ mit Jahr).
// Ergebnis: je Tag d.passend = [{ seite, symbol, titel, ort, jahr, url, gleicherTag }] und
// /atlas/data/querbezuege.json für die Rückverweise auf den anderen Seiten (CORS offen).
import fs from "node:fs";
import path from "node:path";

export const SEITEN = {
  food: { domain: "cleebration.food", symbol: "🍽️", name: "cleebration.food" },
  beer: { domain: "cleebration.beer", symbol: "🍺", name: "cleebration.beer" },
  cars: { domain: "cars.cleebration.com", symbol: "🚗", name: "cars.cleebration.com" },
};
const km = (a, b) => Math.hypot((b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180), b[0] - a[0]) * 111.2;

export async function ladeQuellen(ROOT) {
  const out = {};
  for (const [k, s] of Object.entries(SEITEN)) {
    let daten = null, herkunft = "";
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`https://${s.domain}/atlas-index.json`, { signal: ctl.signal }); clearTimeout(t);
      if (r.ok) { daten = await r.json(); herkunft = "live"; }
    } catch (e) { /* offline beim Bauen → Kopie */ }
    if (!Array.isArray(daten)) {
      const f = path.join(ROOT, "content", "querbezuege", `${k}.json`);
      if (fs.existsSync(f)) { daten = JSON.parse(fs.readFileSync(f, "utf8")); herkunft = "kopie"; }
    }
    out[k] = { eintraege: Array.isArray(daten) ? daten : [], herkunft };
  }
  return out;
}

export function verknuepfe(reisen, quellen, site) {
  const rueck = {};
  for (const r of reisen) {
    const von = r.tage[0] && r.tage[0].datum, bis = r.tage.length && r.tage[r.tage.length - 1].datum;
    for (const d of r.tage) {
      const st = (d.stationen || []).filter((s) => typeof s.lat === "number").map((s) => [s.lat, s.lon]);
      const liste = [];
      for (const [k, q] of Object.entries(quellen)) {
        for (const e of q.eintraege) {
          const gleicherTag = e.date === d.datum;
          const nah = e.lat != null && st.some((p) => km(p, [e.lat, e.lng]) <= 8);
          if (!gleicherTag && !nah) continue;
          if (!gleicherTag && e.date >= von && e.date <= bis) continue; // auf dieser Reise, aber an einem anderen Tag → nur dort zeigen
          const url = `https://${SEITEN[k].domain}/de/${e.slug}/`;
          liste.push({ seite: k, symbol: SEITEN[k].symbol, titel: e.titel, ort: e.ort || "", jahr: (e.date || "").slice(0, 4), url, gleicherTag });
          if (gleicherTag) rueck[`${k}:${e.slug}`] ||= { reise: r.title, tag: d.tag, url: `https://${site.domain}/atlas/${r.slug}/?tag=${d.tag}` };
        }
      }
      liste.sort((a, b) => (b.gleicherTag - a.gleicherTag) || b.jahr.localeCompare(a.jahr));
      d.passend = liste.slice(0, 8);
    }
  }
  return rueck;
}

export function schreibeRueckverweise(DIST, rueck, quellen) {
  fs.writeFileSync(path.join(DIST, "atlas", "data", "querbezuege.json"), JSON.stringify({
    stand: new Date().toISOString().slice(0, 10),
    quellen: Object.fromEntries(Object.entries(quellen).map(([k, q]) => [k, { anzahl: q.eintraege.length, herkunft: q.herkunft }])),
    eintraege: rueck,
  }));
  const hdr = path.join(DIST, "_headers");
  const prev = fs.existsSync(hdr) ? fs.readFileSync(hdr, "utf8") : "";
  if (!prev.includes("/atlas/data/querbezuege.json")) fs.writeFileSync(hdr, prev + (prev && !prev.endsWith("\n") ? "\n" : "") + "/atlas/data/querbezuege.json\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=3600\n");
}
