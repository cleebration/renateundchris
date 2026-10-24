// Reise-Statistik – Dashboard für eine Reise und alle Reisen (/atlas/statistik/).
//
// Beim Bauen (ohne Netz): Kennzahlen je Tag (km, Fahrzeit, Stationen, Fähren, Grenzen, Fotos),
//   Sonnenauf- und -untergang je Tag (berechnet, Ortszeit), Ort für das Wetter (Übernachtung bzw. letzte Station)
//   und Stützpunkte entlang der Route für das Höhenprofil.
// Im Browser (atlas-statistik.js): Wetter (Open-Meteo Archiv) und Höhen (Open-Meteo Elevation) je Reise,
//   im Browser zwischengespeichert. Fällt Open-Meteo aus, bleiben Kennzahlen und Sonnenzeiten sichtbar.

import fs from "node:fs";
import path from "node:path";

// ---------- Sonne (Formeln nach V. Agafonkin, SunCalc, BSD-Lizenz; Höhe −0,833° = Oberrand inkl. Refraktion) ----------
const rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, e = rad * 23.4397, J0 = 0.0009;
const toJulian = (d) => d.valueOf() / dayMs - 0.5 + J1970;
const fromJulian = (j) => new Date((j + 0.5 - J1970) * dayMs);
const toDays = (d) => toJulian(d) - J2000;
const declination = (l) => Math.asin(Math.sin(0) * Math.cos(e) + Math.cos(0) * Math.sin(e) * Math.sin(l));
const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (M) => M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
export function sonne(datum, lat, lon) {
  const date = new Date(datum + "T12:00:00Z");
  const lw = rad * -lon, phi = rad * lat, d = toDays(date);
  const n = Math.round(d - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = solarMeanAnomaly(ds), L = eclipticLongitude(M), dec = declination(L);
  const Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const h0 = -0.833 * rad;
  const cosw = (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosw < -1 || cosw > 1) return null; // Polartag/-nacht
  const w = Math.acos(cosw);
  const a = J2000 + (J0 + (w + lw) / (2 * Math.PI) + n) + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const set = fromJulian(a), rise = fromJulian(Jnoon - (a - Jnoon));
  return { rise, set };
}

// Zeitzone je Land (für die Ortszeit der Sonnenzeiten)
const ZONE = { AT: "Europe/Vienna", SI: "Europe/Ljubljana", HR: "Europe/Zagreb", ME: "Europe/Podgorica", AL: "Europe/Tirane", GR: "Europe/Athens",
  MK: "Europe/Skopje", RS: "Europe/Belgrade", BA: "Europe/Sarajevo", XK: "Europe/Belgrade", BG: "Europe/Sofia", RO: "Europe/Bucharest", HU: "Europe/Budapest",
  SK: "Europe/Bratislava", CZ: "Europe/Prague", PL: "Europe/Warsaw", DE: "Europe/Berlin", CH: "Europe/Zurich", IT: "Europe/Rome", FR: "Europe/Paris",
  ES: "Europe/Madrid", PT: "Europe/Lisbon", TR: "Europe/Istanbul", NL: "Europe/Amsterdam", BE: "Europe/Brussels", LU: "Europe/Luxembourg",
  DK: "Europe/Copenhagen", NO: "Europe/Oslo", SE: "Europe/Stockholm", FI: "Europe/Helsinki", GB: "Europe/London", IE: "Europe/Dublin" };
const hhmm = (date, zone) => new Intl.DateTimeFormat("de-AT", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

// ---------- Route ----------
function decodePoly(s) { // Google Polyline, Genauigkeit 5 → [[lat, lon], …]
  const out = []; let i = 0, lat = 0, lon = 0;
  while (i < s.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do { b = s.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
      const v = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += v; else lon += v;
    }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}
const dist = (a, b) => { const x = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * rad), y = b[0] - a[0]; return Math.hypot(x, y) * 111.2; };
function sample(pts, n) { // n Punkte in gleichem Abstand entlang der Linie
  if (pts.length <= n) return pts;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1]; if (!L) return [pts[0]];
  const out = []; let j = 0;
  for (let k = 0; k < n; k++) { const t = (L * k) / (n - 1); while (j < cum.length - 2 && cum[j + 1] < t) j++; out.push(pts[j]); }
  return out;
}
const r4 = (p) => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];

// ---------- je Tag ----------
export function tagStatistik(t) {
  const st = (t.stationen || []).filter((s) => typeof s.lat === "number" && typeof s.lon === "number");
  const ueb = [...st].reverse().find((s) => s.art === "uebernachtung") || st[st.length - 1] || null;
  const land = (t.land || [])[(t.land || []).length - 1] || "AT";
  const zone = ZONE[land] || "Europe/Vienna";
  let sun = null;
  if (ueb && t.datum) {
    const s = sonne(t.datum, ueb.lat, ueb.lon);
    if (s) sun = { auf: hhmm(s.rise, zone), unter: hhmm(s.set, zone), min: Math.round((s.set - s.rise) / 6e4) };
  }
  let hp = [];
  if (t.route && t.route.poly) hp = sample(decodePoly(t.route.poly), 12);
  else if (st.length) hp = sample(st.map((s) => [s.lat, s.lon]), 8);
  const art = (a) => st.filter((s) => s.art === a).length;
  return {
    tag: t.tag, datum: t.datum, titel: t.titel || "", land: t.land || [],
    ort: ueb ? { name: ueb.name, lat: Math.round(ueb.lat * 1e3) / 1e3, lon: Math.round(ueb.lon * 1e3) / 1e3 } : null,
    km: (t.route && t.route.km) || 0, fahrMin: (t.route && t.route.min) || 0,
    stationen: (t.stationen || []).length, faehren: art("faehre"), grenzen: art("grenze"), pannen: art("panne"), essen: art("essen"), aussicht: art("aussicht"),
    fotos: (t.fotos || []).length, fotoZeiten: (t.fotos || []).map((f) => f.zeit).filter(Boolean),
    sonne: sun, hp: hp.map(r4),
  };
}

// ---------- Seite ----------
function shell(site, v) {
  return `<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Reise-Statistik · Renate &amp; Chris</title>
<meta name="description" content="Unsere Reisen in Zahlen: Kilometer, Länder, Wetter, Sonnenaufgänge, Rekorde und Abzeichen.">
<link rel="canonical" href="https://${site.domain}/atlas/statistik/">
<meta property="og:title" content="Reise-Statistik · Renate &amp; Chris">
<meta name="theme-color" content="#0a1b23">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/atlas/atlas-statistik.css?v=${v}">
</head><body>
<div id="stat" data-v="${v}"></div>
<noscript><p style="padding:24px">Die Reise-Statistik braucht JavaScript.</p></noscript>
<script src="/atlas/atlas-statistik.js?v=${v}"></script>
</body></html>`;
}

export function buildStatistik({ ROOT, DIST, site, reisen }) {
  // reisen: [{ slug, title, accent, fahrzeug, tage:[…tripData-Tage] }] – neueste zuerst
  const out = path.join(DIST, "atlas");
  const data = {
    stand: new Date().toISOString().slice(0, 10),
    reisen: reisen.map((r) => ({ slug: r.slug, title: r.title, accent: r.accent || "#e0913a", fahrzeug: r.fahrzeug || "", tage: r.tage.map(tagStatistik) })),
  };
  fs.writeFileSync(path.join(out, "data", "statistik.json"), JSON.stringify(data));
  for (const f of ["atlas-statistik.js", "atlas-statistik.css"]) {
    const src = path.join(ROOT, "src", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, f));
  }
  const v = Date.now().toString(36);
  fs.mkdirSync(path.join(out, "statistik"), { recursive: true });
  fs.writeFileSync(path.join(out, "statistik", "index.html"), shell(site, v));
  const hdr = path.join(DIST, "_headers");
  const prev = fs.existsSync(hdr) ? fs.readFileSync(hdr, "utf8") : "";
  if (!prev.includes("/atlas/statistik/")) fs.writeFileSync(hdr, prev + (prev && !prev.endsWith("\n") ? "\n" : "") + "/atlas/statistik/\n  Cache-Control: no-cache\n/atlas/statistik/index.html\n  Cache-Control: no-cache\n");
  return data.reisen.length;
}
