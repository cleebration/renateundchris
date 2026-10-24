// Weltkugel – Startseite des Reise-Atlas (/atlas/): alle Reisen als Linien auf einem drehbaren Globus.
//   /atlas/data/welt.json   je Reise: Titel, Zeitraum, Titelbild, Farbe, Kennzahlen, vereinfachte Route
//   Alte Controller-Links /atlas/#c-<code> werden auf die neueste Reise umgeleitet.
import fs from "node:fs";
import path from "node:path";

function decodePoly(s) {
  const out = []; let i = 0, lat = 0, lon = 0;
  while (i < s.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = s.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
      const v = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += v; else lon += v;
    }
    out.push([lon / 1e5, lat / 1e5]);
  }
  return out;
}
const km = (a, b) => Math.hypot((b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180), b[1] - a[1]) * 111.2;

// Route der ganzen Reise: Straßenrouten der Tage, sonst die Stationen; ausgedünnt auf Punkte mit ≥ 3 km Abstand
function reiseLinie(tage) {
  const roh = [];
  for (const d of tage) {
    if (d.route && d.route.poly) roh.push(...decodePoly(d.route.poly));
    else for (const s of d.stationen || []) if (typeof s.lat === "number") roh.push([s.lon, s.lat]);
  }
  const out = [];
  for (const p of roh) if (!out.length || km(out[out.length - 1], p) >= 3) out.push(p);
  if (roh.length && out[out.length - 1] !== roh[roh.length - 1]) out.push(roh[roh.length - 1]);
  return out.map((p) => [Math.round(p[0] * 1e3) / 1e3, Math.round(p[1] * 1e3) / 1e3]);
}

function shell(site, v, neueste) {
  return `<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<script>if (/^#c-/.test(location.hash)) location.replace("/atlas/${neueste}/" + location.hash);</script>
<title>Reise-Atlas · Alle Reisen · Renate &amp; Chris</title>
<meta name="description" content="Alle Reisen von Renate &amp; Chris auf einer Weltkugel – drehen, auswählen, eintauchen.">
<link rel="canonical" href="https://${site.domain}/atlas/">
<meta property="og:title" content="Reise-Atlas · Renate &amp; Chris">
<meta property="og:description" content="Alle unsere Reisen auf einer Weltkugel.">
<meta name="theme-color" content="#05121a">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css">
<link rel="stylesheet" href="/atlas/atlas-welt.css?v=${v}">
</head><body>
<div id="welt" data-v="${v}"></div>
<noscript><p style="padding:24px">Die Weltkugel braucht JavaScript. Alle Reisen gibt es unter <a href="/reisen">/reisen</a>.</p></noscript>
<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
<script src="/atlas/atlas-welt.js?v=${v}"></script>
</body></html>`;
}

export function buildWelt({ ROOT, DIST, site, reisen }) {
  // reisen: [{ slug, title, zeitraum, cover, accent, laender, fahrzeug, tage }] – neueste zuerst
  if (!reisen.length) return 0;
  const out = path.join(DIST, "atlas");
  const data = {
    zuhause: { name: "Linz", lon: 14.286, lat: 48.306 },
    reisen: reisen.map((r) => {
      const linie = reiseLinie(r.tage);
      const lo = linie.map((p) => p[0]), la = linie.map((p) => p[1]);
      return {
        slug: r.slug, title: r.title, zeitraum: r.zeitraum || "", cover: r.cover || "", accent: r.accent || "#e0913a", fahrzeug: r.fahrzeug || "",
        start: (r.tage[0] || {}).datum || "", tage: r.tage.length, laender: [...new Set(r.tage.flatMap((d) => d.land || []))],
        km: Math.round(r.tage.reduce((a, d) => a + ((d.route && d.route.km) || 0), 0)),
        fotos: r.tage.reduce((a, d) => a + (d.fotos || []).length, 0),
        bbox: linie.length ? [Math.min(...lo), Math.min(...la), Math.max(...lo), Math.max(...la)] : null,
        linie,
      };
    }),
  };
  fs.writeFileSync(path.join(out, "data", "welt.json"), JSON.stringify(data));
  for (const f of ["atlas-welt.js", "atlas-welt.css"]) {
    const src = path.join(ROOT, "src", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
  }
  const v = Date.now().toString(36);
  fs.writeFileSync(path.join(out, "index.html"), shell(site, v, reisen[0].slug));
  return data.reisen.length;
}
