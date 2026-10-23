// Reise-Atlas – die ganze Reise als spielbare Karte.
//
//   /atlas/                    Bildschirm (Mac, TV)  ·  /atlas/#c-<code>  iPhone als Controller
//   /atlas/data/<reise>.json   Daten: Tage, Stationen, Routen, Fotos, Links zu Tagesseiten
//
// Quellen je Reise (content/reisen/<reise>/):
//   _atlas.json   Tage und Stationen (aus den Tagebuchdateien)
//   _routen.json  Straßenrouten je Tag (OSRM, Polyline precision 5)
//   _karte.json   Fotos je Tag (wie für die Tagesseiten)
//   Tag-XX_Ort.md vorhandene Tagesseiten → Link „Tagebuch lesen“
//
// Aufruf aus build.mjs:  buildAtlas({ ROOT, DIST, site })

import { neuesteZuerst } from "./reisen-sort.mjs";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "./reisen.mjs";

const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

function tripData(ROOT, slug) {
  const dir = path.join(ROOT, "content", "reisen", slug);
  const atlas = readJson(path.join(dir, "_atlas.json"));
  if (!atlas) return null;
  const routen = readJson(path.join(dir, "_routen.json")) || { tage: {} };
  const karte = readJson(path.join(dir, "_karte.json")) || { tage: [] };

  // vorhandene Tagesseiten: Tag-XX_Ort.md → slug wie in reisen.mjs
  const seiten = {};
  for (const f of fs.readdirSync(dir)) {
    const m = /^Tag-(\d+)[a-z]?_(.+)\.md$/i.exec(f);
    if (!m) continue;
    const tag = +m[1];
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const fm = (/^---\r?\n([\s\S]*?)\r?\n---/.exec(raw) || [, ""])[1];
    const own = /^slug:\s*(.+)$/m.exec(fm);
    const ort = (/^ort:\s*(.+)$/m.exec(fm) || [, m[2].replace(/[-_]/g, " ")])[1].trim().replace(/^["']|["']$/g, "");
    const s = own ? own[1].trim().replace(/^["']|["']$/g, "") : `tag-${String(tag).padStart(2, "0")}-${slugify(ort)}`;
    seiten[tag] = { slug: s, url: `/reise/${slug}/${s}` };
  }

  const fotosAuto = readJson(path.join(dir, "_fotos.json")) || { tage: {} };
  const nearest = (stationen, lat, lon) => {
    let best = null, bd = Infinity;
    for (const s of stationen || []) {
      if (typeof s.lat !== "number" || typeof lat !== "number") continue;
      const d = (s.lat - lat) ** 2 + ((s.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best && bd < 0.0009 ? best.name : null; // ~3 km
  };

  const tage = atlas.tage.map((t) => {
    const k = (karte.tage || []).find((x) => x.datum === t.datum);
    const seite = seiten[t.tag];
    let fotos = ((k && k.fotos) || [])
      .filter((f) => f.web)
      .map((f) => ({
        url: seite ? `/assets/reisen/${slug}/${seite.slug}/${f.datei}` : null,
        lat: f.lat, lon: f.lon, text: f.text || "", zeit: f.zeit || "", gps: f.gps || "",
      }))
      .filter((f) => f.url);
    if (!fotos.length) {
      fotos = (fotosAuto.tage[String(t.tag)] || []).map((f) => ({
        url: `${fotosAuto.pfad}/tag-${String(t.tag).padStart(2, "0")}/${f.datei}`,
        lat: f.lat, lon: f.lon, zeit: f.zeit || "", gps: f.gps || "", hoch: !!f.hoch,
        text: nearest(t.stationen, f.lat, f.lon) || t.titel || "",
      }));
    }
    return { ...t, route: routen.tage[String(t.tag)] || null, seite: seite ? seite.url : null, fotos };
  });
  return { reise: slug, quelleRouten: routen.quelle || "", tage };
}

function shell(site, trips) {
  const t = trips[0];
  const v = Date.now().toString(36);
  return `<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Reise-Atlas · ${t.title} · Renate &amp; Chris</title>
<meta name="description" content="${t.title} als spielbare Karte: 31 Tage, sieben Länder, ein Campervan. Am Mac oder TV ansehen, mit dem iPhone steuern.">
<link rel="canonical" href="https://${site.domain}/atlas/${t.slug}/">
<meta property="og:title" content="Reise-Atlas · ${t.title}">
<meta property="og:description" content="Die ganze Reise als spielbare Karte – mit dem iPhone als Controller.">
<meta name="theme-color" content="#0a1b23">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<link rel="stylesheet" href="/atlas/atlas.css?v=${v}">
</head><body>
<div id="app" data-reise="${t.slug}" data-title="${t.title}" data-v="${v}"></div>
<noscript><p style="padding:24px">Der Reise-Atlas braucht JavaScript. Die Tagesseiten gibt es unter <a href="/reise/${t.slug}/">/reise/${t.slug}/</a>.</p></noscript>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js"></script>
<script src="https://unpkg.com/qrcode-generator@1.4.4/qrcode.js"></script>
<script src="/atlas/atlas.js?v=${v}"></script>
</body></html>`;
}

export function buildAtlas({ ROOT, DIST, site }) {
  const reisen = readJson(path.join(ROOT, "reisen.json"));
  if (!reisen) return 0;
  const trips = neuesteZuerst(ROOT, reisen.trips.filter((t) => fs.existsSync(path.join(ROOT, "content", "reisen", t.slug, "_atlas.json"))));
  if (!trips.length) return 0;
  const out = path.join(DIST, "atlas");
  fs.mkdirSync(path.join(out, "data"), { recursive: true });
  let n = 0;
  for (const t of trips) {
    const data = tripData(ROOT, t.slug);
    if (!data) continue;
    data.title = t.title;
    data.fahrzeug = t.fahrzeug || "";
    fs.writeFileSync(path.join(out, "data", `${t.slug}.json`), JSON.stringify(data));
    n += data.tage.length;
  }
  for (const f of ["atlas.js", "atlas.css"]) {
    const src = path.join(ROOT, "src", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
  }
  // je Reise eine eigene Seite /atlas/<reise>/; /atlas/ zeigt die neueste Reise (erste in reisen.json)
  for (const t of trips) {
    fs.mkdirSync(path.join(out, t.slug), { recursive: true });
    fs.writeFileSync(path.join(out, t.slug, "index.html"), shell(site, [t]));
  }
  fs.writeFileSync(path.join(out, "index.html"), shell(site, trips));
  // alte Reise-Übersichten → Atlas
  const red = path.join(DIST, "_redirects");
  const prevR = fs.existsSync(red) ? fs.readFileSync(red, "utf8") : "";
  const lines = trips.map((t) => `/reise/${t.slug}/ /atlas/${t.slug}/ 301\n/reise/${t.slug} /atlas/${t.slug}/ 301\n`).join("");
  fs.writeFileSync(red, prevR + (prevR && !prevR.endsWith("\n") ? "\n" : "") + lines);
  // Cache-Regeln: Seite und Daten immer frisch prüfen, Fotos lange cachen
  const hdr = path.join(DIST, "_headers");
  const rules = "/atlas/\n  Cache-Control: no-cache\n/atlas/index.html\n  Cache-Control: no-cache\n/atlas/data/*\n  Cache-Control: no-cache\n/atlas/atlas.*\n  Cache-Control: no-cache\n" +
    trips.map((t) => `/atlas/${t.slug}/\n  Cache-Control: no-cache\n/atlas/${t.slug}/index.html\n  Cache-Control: no-cache\n`).join("");
  const prev = fs.existsSync(hdr) ? fs.readFileSync(hdr, "utf8") : "";
  if (!prev.includes("/atlas/data/*")) fs.writeFileSync(hdr, prev + (prev && !prev.endsWith("\n") ? "\n" : "") + rules);
  return n;
}
