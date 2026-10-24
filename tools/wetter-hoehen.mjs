// Wetter und Höhen je Reisetag fest einspeichern (statt sie im Browser der Besucher zu laden).
//   node tools/wetter-hoehen.mjs [reise]            → Höhen (Open-Meteo Elevation) holen, _hoehe.json schreiben
//   node tools/wetter-hoehen.mjs --wetter <datei>    → Wetter-Rohdaten { reise: { tag: [code,max,min,regen,sonne_s,wind] } } in _wetter.json übernehmen
// Wetter: Open-Meteo Archiv (ERA5), Tageswerte am Übernachtungsort, Ortszeit. Höhen: Copernicus DEM entlang der Route.
// Braucht Netz-Freigabe für archive-api.open-meteo.com bzw. api.open-meteo.com.
import fs from "node:fs";
import path from "node:path";
import { tagStatistik } from "../scripts/atlas-statistik.mjs";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = (s) => path.join(ROOT, "content", "reisen", s);
const reisen = JSON.parse(fs.readFileSync(path.join(ROOT, "reisen.json"), "utf8")).trips.map((t) => t.slug).filter((s) => fs.existsSync(path.join(dir(s), "_atlas.json")));
const arg = process.argv.slice(2);
if (arg[0] === "--wetter") {
  const roh = JSON.parse(fs.readFileSync(arg[1], "utf8"));
  for (const [s, tage] of Object.entries(roh)) {
    const out = { quelle: "Open-Meteo Archiv (ERA5), Tageswerte am Übernachtungsort, CC BY 4.0", stand: new Date().toISOString().slice(0, 10), tage: {} };
    for (const [t, [code, max, min, regen, sonne, wind]] of Object.entries(tage)) out.tage[t] = { code, max, min, regen, sonneH: sonne == null ? null : Math.round((sonne / 3600) * 10) / 10, wind };
    fs.writeFileSync(path.join(dir(s), "_wetter.json"), JSON.stringify(out, null, 1));
    console.log(`✓ ${s}: Wetter für ${Object.keys(out.tage).length} Tage`);
  }
} else {
  for (const s of arg.length ? arg : reisen) {
    const atlas = JSON.parse(fs.readFileSync(path.join(dir(s), "_atlas.json"), "utf8"));
    const routen = fs.existsSync(path.join(dir(s), "_routen.json")) ? JSON.parse(fs.readFileSync(path.join(dir(s), "_routen.json"), "utf8")) : { tage: {} };
    const pts = [];
    for (const t of atlas.tage) tagStatistik({ ...t, route: routen.tage[String(t.tag)] }).hp.forEach((p, i) => pts.push({ tag: t.tag, i, p }));
    const out = { quelle: "Open-Meteo Elevation (Copernicus DEM GLO-90), Stützpunkte entlang der Route, CC BY 4.0", stand: new Date().toISOString().slice(0, 10), tage: {} };
    for (let i = 0; i < pts.length; i += 100) {
      const g = pts.slice(i, i + 100);
      const q = new URLSearchParams({ latitude: g.map((x) => x.p[0]).join(","), longitude: g.map((x) => x.p[1]).join(",") });
      const r = await fetch("https://api.open-meteo.com/v1/elevation?" + q);
      if (!r.ok) throw new Error(`${s}: Höhen ${r.status} ${await r.text()}`);
      const j = await r.json();
      g.forEach((x, k) => { (out.tage[x.tag] ||= [])[x.i] = Math.max(0, Math.round(j.elevation[k])); });
      await new Promise((r) => setTimeout(r, 1500));
    }
    fs.writeFileSync(path.join(dir(s), "_hoehe.json"), JSON.stringify(out));
    console.log(`✓ ${s}: Höhen für ${Object.keys(out.tage).length} Tage (${pts.length} Punkte)`);
  }
}
