// Reisekarte für renateundchris.com – Strecken, Übernachtungen, Fotopunkte.
// Karte: Leaflet + OpenStreetMap. Daten: content/reisen/<reise>/_karte.json
// (Unterstrich = wird von reisen.mjs nicht als Tageseintrag gelesen).
//
// Eingebunden aus reisen.mjs:
//   karteTrip(trip, days, ctx)  → Karte mit Filtern auf der Reise-Seite
//   karteTag(day, ctx)          → Karte des Tages auf der Etappen-Seite
//   karteAssets(ROOT, DIST)     → kopiert src/reisen-karte.js nach /dist
// v2 (2026-09-30): Strecken dürfen als pts oder als polyline5 (OSRM) vorliegen.

import fs from "node:fs";
import path from "node:path";

const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4";
const cache = new Map();

function load(ROOT, slug) {
  if (cache.has(slug)) return cache.get(slug);
  const file = path.join(ROOT, "content", "reisen", slug, "_karte.json");
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  cache.set(slug, data);
  return data;
}

const r5 = (n) => Math.round(n * 1e5) / 1e5;
const pts = (a = []) => a.map(([la, lo]) => [r5(la), r5(lo)]);

// Google/OSRM-Polyline (Genauigkeit 5) → [[lat, lon], …]; so bleiben lange Strecken in der JSON klein
export function polyline5(str = "") {
  const out = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, v = 0;
      do { b = str.charCodeAt(i++) - 63; v |= (b & 31) << shift; shift += 5; } while (b >= 32);
      const d = v & 1 ? ~(v >> 1) : v >> 1;
      if (k === 0) lat += d; else lon += d;
    }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

export function kmSumme(tag) {
  const s = { auto: 0, rad: 0 };
  for (const w of tag.wege || []) if (s[w.typ] !== undefined && w.km) s[w.typ] += w.km;
  return { auto: Math.round(s.auto * 10) / 10, rad: Math.round(s.rad * 10) / 10 };
}

// Kopfzeile: Datum · Auto X km · Rad ca. Y km · Übernachtung: Name
export function kopfzeile(tag, datumText) {
  const k = kmSumme(tag);
  const teile = [datumText];
  if (k.auto) teile.push(`Auto ${String(k.auto).replace(".", ",")} km`);
  if (k.rad) teile.push(`Rad ca. ${String(k.rad).replace(".", ",")} km`);
  if (tag.uebernachtung?.name) teile.push(`Übernachtung: ${tag.uebernachtung.name}`);
  return teile.join(" · ");
}

function tagDaten(t, slugVonTag, fotoBasis) {
  return {
    tag: t.tag, datum: t.datum, titel: t.titel,
    url: slugVonTag ? slugVonTag(t.tag) : null,
    regionen: t.regionen || [], orte: t.orte || [],
    km: kmSumme(t),
    wege: (t.wege || []).map((w) => ({ typ: w.typ, label: w.label || "", km: w.km ?? null, pts: pts(w.pts || polyline5(w.polyline5)) })),
    uebernachtung: t.uebernachtung || null,
    essen: t.essen || null,
    stellen: t.stellen || [],
    fotos: fotoBasis === undefined ? [] : (t.fotos || [])
      .filter((f) => f.web && f.lat != null)
      .map((f, i) => ({ nr: i + 1, datei: f.datei, lat: r5(f.lat), lon: r5(f.lon),
                        text: f.text || "", src: fotoBasis + f.datei })),
  };
}

const hülle = (json, klasse, esc, extra = "") => `
<section class="r-karte ${klasse}">
  ${extra}
  <div class="r-karte-map" role="region" aria-label="Karte"></div>
  <p class="r-karte-legende"><span class="lg-auto">Auto</span><span class="lg-rad">Fahrrad</span><span class="lg-faehre">Fähre</span></p>
  <script type="application/json" class="r-karte-daten">${JSON.stringify(json).replace(/</g, "\\u003c")}</script>
</section>
<link rel="stylesheet" href="${LEAFLET}/leaflet.min.css">
<link rel="stylesheet" href="/reisen-karte.css">
<script defer src="${LEAFLET}/leaflet.min.js"></script>
<script defer src="/reisen-karte.js"></script>`;

export function karteTrip(trip, days, ctx) {
  const data = load(ctx.ROOT, trip.slug);
  if (!data) return "";
  const slugs = new Map(days.map((d) => [d.tag, `/reise/${trip.slug}/${d.slug}`]));
  const json = {
    modus: "reise",
    orte: data.orte || [],
    tage: (data.tage || []).map((t) => tagDaten(t, (n) => slugs.get(n) || null)),
  };
  const filter = `<div class="r-karte-filter">
    <label>Tag <select class="f-tag"><option value="">alle Tage</option></select></label>
    <div class="f-chips f-region" aria-label="Region"></div>
    <div class="f-chips f-ort" aria-label="Ort"></div>
  </div>
  <p class="r-karte-kopf"></p>`;
  return `<div class="h r-karte-h">Die Route</div>` + hülle(json, "is-reise", ctx.esc, filter);
}

export function karteTag(day, ctx) {
  const data = load(ctx.ROOT, day.trip.slug);
  const t = data?.tage?.find((x) => Number(x.tag) === Number(day.tag));
  if (!t) return "";
  const basis = `/assets/reisen/${day.trip.slug}/${day.slug}/`;
  const json = { modus: "tag", orte: data.orte || [], tage: [tagDaten(t, null, basis)] };
  const kopf = `<p class="r-karte-kopf"></p>`;
  return `<div class="h r-karte-h">Der Tag auf der Karte</div>` + hülle(json, "is-tag", ctx.esc, kopf);
}

export function karteAssets(ROOT, DIST) {
  for (const f of ["reisen-karte.js", "reisen-karte.css"]) {
    const src = path.join(ROOT, "src", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
  }
}
