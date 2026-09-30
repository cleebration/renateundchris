// Reisetagebuch – erzeugt aus content/reisen/<reise>/Tag-XX_Ort.md die Reise-Seiten.
// Gleiche Philosophie wie build.mjs: keine Abhängigkeiten, nur Node.
//
//   /reisen                         Übersicht aller Reisen
//   /reise/<reise>/                 eine Reise, alle Etappen
//   /reise/<reise>/tag-13-hvar      eine Etappe
//
// v2 (2026-09-30): Reisekarte mit OpenStreetMap, siehe reisen-karte.mjs
//
// Aufruf aus build.mjs:  buildReisen({ ROOT, DIST, page, newsletter, esc, site })

import fs from "node:fs";
import path from "node:path";
import { karteTrip, karteTag, karteAssets } from "./reisen-karte.mjs";

/* ---------- Hilfen ---------- */

const MONTHS_DE = ["Jänner","Februar","März","April","Mai","Juni","Juli","August",
                   "September","Oktober","November","Dezember"];
const DAYS_DE = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

export function slugify(s = "") {
  return String(s).toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function dateLong(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return String(iso || "");
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${DAYS_DE[d.getUTCDay()]}, ${+m[3]}. ${MONTHS_DE[+m[2] - 1]} ${m[1]}`;
}
function dateShort(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  return m ? `${+m[3]}.${+m[2]}.` : String(iso || "");
}

/* ---------- Frontmatter ---------- */
// Unterstützt: key: wert  ·  key:\n  - wert  ·  key:\n  - unterkey: wert

function parseFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { meta: {}, body: text };

  const meta = {};
  const lines = m[1].split(/\r?\n/);
  let key = null;

  const val = (s) => {
    let v = s.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  };

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item && key) {
      const inline = /^([A-Za-zÄÖÜäöü0-9_]+)\s*:\s*(.*)$/.exec(item[1]);
      if (inline) {
        const obj = { [inline[1]]: val(inline[2]) };
        meta[key].push(obj);
      } else {
        meta[key].push(val(item[1]));
      }
      continue;
    }

    // Fortsetzungszeile eines Objekts in einer Liste
    const sub = /^\s{2,}([A-Za-zÄÖÜäöü0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (sub && key && Array.isArray(meta[key]) && meta[key].length) {
      const last = meta[key][meta[key].length - 1];
      if (last && typeof last === "object") { last[sub[1]] = val(sub[2]); continue; }
    }

    const kv = /^([A-Za-zÄÖÜäöü0-9_]+)\s*:\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      if (kv[2].trim() === "") meta[key] = [];
      else meta[key] = val(kv[2]);
    }
  }

  return { meta, body: text.slice(m[0].length) };
}

/* ---------- Markdown → HTML ---------- */
// Bewusst kleine Teilmenge: genau das, was in den Tagebuchdateien vorkommt.

const escHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s) {
  let t = escHtml(s);
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy">`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, href) => {
    const ext = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${href}"${ext}>${txt}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
  t = t.replace(/ – /g, " – ").replace(/---/g, "—");
  return t;
}

function tableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Leerzeile
    if (!line.trim()) { i++; continue; }

    // Codeblock
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // Trennlinie
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }

    // Überschriften (H1 der Datei wird ignoriert – die Seite hat schon eine)
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = Math.min(Math.max(h[1].length, 2), 4);
      if (h[1].length === 1) { i++; continue; }
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // Tabelle
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]*-[-\s|:]*$/.test(lines[i + 1])) {
      const head = tableRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(tableRow(lines[i++]));
      out.push(
        `<div class="r-tablewrap"><table class="r-table"><thead><tr>` +
        head.map((c) => `<th>${inline(c)}</th>`).join("") +
        `</tr></thead><tbody>` +
        rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table></div>`
      );
      continue;
    }

    // Zitat
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // Listen
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
      }
      out.push(`<ul>${buf.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        buf.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      }
      out.push(`<ol>${buf.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`);
      continue;
    }

    // Absatz
    const buf = [];
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,6}\s|>\s?|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*\|)/.test(lines[i]) &&
           !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    if (buf.length) {
      const p = inline(buf.join(" "));
      // Ein Absatz, der nur aus einem Bild besteht, wird zur Figur
      out.push(/^<img [^>]+>$/.test(p) ? `<figure class="r-fig">${p}</figure>` : `<p>${p}</p>`);
    } else { i++; }
  }

  return out.join("\n");
}

/* ---------- Einlesen ---------- */

function readTrip(ROOT, trip) {
  const dir = path.join(ROOT, "content", "reisen", trip.slug);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"));

  const days = files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);

    const tag = Number(meta.tag ?? (/Tag-(\d+)/i.exec(file)?.[1] ?? 0));
    const ort = meta.ort || (/Tag-\d+[_-](.+)\.md$/i.exec(file)?.[1] || "").replace(/[-_]/g, " ");
    const slug = meta.slug || `tag-${String(tag).padStart(2, "0")}-${slugify(ort)}`;
    const fotos = (Array.isArray(meta.fotos) ? meta.fotos : []).map((f) =>
      typeof f === "string" ? { datei: f, text: "" } : f
    );

    return {
      file, tag, ort, slug,
      datum: meta.datum || "",
      titel: meta.titel || ort,
      zusammenfassung: meta.zusammenfassung || "",
      koordinaten: meta.koordinaten || "",
      titelbild: meta.titelbild || (fotos[0] && fotos[0].datei) || "",
      fotos,
      html: mdToHtml(body),
      trip,
    };
  });

  days.sort((a, b) => a.tag - b.tag || String(a.datum).localeCompare(String(b.datum)));
  return days;
}

const fotoUrl = (day, datei) =>
  /^(https?:)?\//.test(datei)
    ? datei
    : `/assets/reisen/${day.trip.slug}/${day.slug}/${datei}`;

/* ---------- Seiten ---------- */

function tripAccent(t) {
  return `--accent:${t.accent};--accent-ink:${t.accentInk};--wash:${t.wash}`;
}

function dayNav(day, days, esc) {
  const idx = days.findIndex((d) => d.slug === day.slug);
  const prev = idx > 0 ? days[idx - 1] : null;
  const next = idx < days.length - 1 ? days[idx + 1] : null;
  const base = `/reise/${day.trip.slug}`;
  return `<nav class="bookbar" aria-label="Etappen-Navigation">
    <a class="pg pg-back" href="${base}/">
      <span class="pg-dir">← Übersicht</span>
      <span class="pg-title">${esc(day.trip.title)}</span>
    </a>
    <div class="pager">
      ${prev ? `<a class="pg pg-prev" href="${base}/${prev.slug}" title="${esc(prev.titel)}">
        <span class="pg-dir">← Tag ${prev.tag}</span>
        <span class="pg-title">${esc(prev.ort)}</span></a>` : `<span class="pg pg-prev is-off"><span class="pg-dir">← Tag</span><span class="pg-title">Anfang</span></span>`}
      ${next ? `<a class="pg pg-next" href="${base}/${next.slug}" title="${esc(next.titel)}">
        <span class="pg-dir">Tag ${next.tag} →</span>
        <span class="pg-title">${esc(next.ort)}</span></a>` : `<span class="pg pg-next is-off"><span class="pg-dir">Tag →</span><span class="pg-title">Ende</span></span>`}
    </div>
  </nav>`;
}

function heroBild(day, esc) {
  if (!day.titelbild) return "";
  const bu = day.fotos.find((f) => f.datei === day.titelbild);
  return `<figure class="r-hero" id="bild-${esc(day.titelbild)}">
    <img src="${fotoUrl(day, day.titelbild)}" alt="${esc((bu && bu.text) || day.ort)}">
    ${bu && bu.text ? `<figcaption>${esc(bu.text)}</figcaption>` : ""}
  </figure>`;
}

function gallery(day, esc) {
  // Das Titelbild steht schon oben – hier nicht noch einmal.
  const rest = day.fotos.filter((f) => f.datei !== day.titelbild);
  if (!rest.length) return "";
  const figs = rest.map((f) => `<figure class="r-shot" id="bild-${esc(f.datei)}">
      <img src="${fotoUrl(day, f.datei)}" alt="${esc(f.text || day.ort)}" loading="lazy">
      ${f.text ? `<figcaption>${esc(f.text)}</figcaption>` : ""}
    </figure>`).join("");
  return `<section class="r-gallery"><div class="h">Bilder des Tages</div>
    <div class="r-shots">${figs}</div>
    </section>`;
}

function buildDay(day, days, ctx) {
  const { page, newsletter, esc, site } = ctx;
  const t = day.trip;
  const geo = day.koordinaten
    ? `<a class="r-geo" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(day.koordinaten).split(",")[0].trim())}&mlon=${encodeURIComponent(String(day.koordinaten).split(",")[1]?.trim() || "")}#map=12" target="_blank" rel="noopener">Auf der Karte ansehen →</a>`
    : "";

  const body = `<main class="wrap detailwrap">
    ${dayNav(day, days, esc)}
    <article class="r-day">
      <div class="d-eyebrow">
        <span class="badge">Tag ${day.tag}</span>
        <span class="contribs">${esc(dateLong(day.datum))} · ${esc(day.ort)}</span>
      </div>
      <h1>${esc(day.titel)}</h1>
      ${day.zusammenfassung ? `<p class="sub">${esc(day.zusammenfassung)}</p>` : ""}
      ${geo}
      ${heroBild(day, esc)}
      <div class="r-prose">${day.html}</div>
    </article>
    ${gallery(day, esc)}
    ${karteTag(day, ctx)}
    ${newsletter(`reise-${t.slug}`)}
  </main>`;

  return page({
    title: `${day.titel} · Tag ${day.tag} · ${t.title}`,
    desc: day.zusammenfassung || `${t.title} – Tag ${day.tag}: ${day.ort}`,
    bodyStyle: tripAccent(t),
    image: day.titelbild ? `https://${site.domain}${fotoUrl(day, day.titelbild)}` : "",
    canonical: `https://${site.domain}/reise/${t.slug}/${day.slug}`,
    extraHead: `<link rel="stylesheet" href="/reisen.css">`,
    body,
  });
}

function buildTrip(t, days, ctx) {
  const { page, newsletter, esc, site } = ctx;

  const cards = days.map((d) => `<a class="r-card" href="/reise/${t.slug}/${d.slug}">
      <div class="r-thumb">${d.titelbild
        ? `<img src="${fotoUrl(d, d.titelbild)}" alt="${esc(d.ort)}" loading="lazy">`
        : `<div class="fallback" style="background:${t.accent}">${esc(d.ort)}</div>`}</div>
      <div class="r-cmeta">
        <span class="c-kicker"><span class="c-dot" style="background:${t.accent}"></span>Tag ${d.tag} · ${esc(dateShort(d.datum))}</span>
        <span class="c-title">${esc(d.titel)}</span>
        <span class="c-by">${esc(d.ort)}</span>
        ${d.zusammenfassung ? `<span class="r-sum">${esc(d.zusammenfassung)}</span>` : ""}
      </div>
    </a>`).join("");

  const body = `<main class="wrap">
    <a class="pg pg-back" href="/reisen">
      <span class="pg-dir">← Übersicht</span>
      <span class="pg-title">Alle Reisen</span>
    </a>
    <section class="hero">
      <div class="eyebrow">${days.length} Etappen · ${esc(t.zeitraum || "")}</div>
      <h1>${esc(t.title)}</h1>
      <p class="lede">${esc(t.blurb || "")}</p>
      ${t.laender ? `<p class="r-laender">${(t.laender || []).map((l) => `<span>${esc(l)}</span>`).join("")}</p>` : ""}
    </section>
    ${karteTrip(t, days, ctx)}
    <section class="r-grid">${cards || `<p class="note">Die ersten Etappen sind in Arbeit.</p>`}</section>
    ${newsletter(`reise-${t.slug}`)}
  </main>`;

  return page({
    title: `${t.title} · Reisetagebuch · Renate & Chris`,
    desc: t.blurb || t.title,
    bodyStyle: tripAccent(t),
    image: t.cover ? `https://${site.domain}${t.cover}` : "",
    canonical: `https://${site.domain}/reise/${t.slug}/`,
    extraHead: `<link rel="stylesheet" href="/reisen.css">`,
    body,
  });
}

function buildIndex(trips, counts, ctx) {
  const { page, newsletter, esc, site } = ctx;

  const cards = trips.map((t) => `<a class="r-card" href="/reise/${t.slug}/">
      <div class="r-thumb">${t.cover
        ? `<img src="${t.cover}" alt="${esc(t.title)}" loading="lazy">`
        : `<div class="fallback" style="background:${t.accent}">${esc(t.title)}</div>`}</div>
      <div class="r-cmeta">
        <span class="c-kicker"><span class="c-dot" style="background:${t.accent}"></span>${esc(t.zeitraum || "")}</span>
        <span class="c-title">${esc(t.title)}</span>
        <span class="c-by">${(t.laender || []).join(" · ")}</span>
        <span class="r-sum">${esc(t.blurb || "")}</span>
        <span class="c-price">${counts[t.slug] || 0} Etappen</span>
      </div>
    </a>`).join("");

  const body = `<main class="wrap">
    <section class="hero">
      <div class="eyebrow">${trips.length} ${trips.length === 1 ? "Reise" : "Reisen"} · ein Tagebuch</div>
      <h1>Wege, die wir <em>gemeinsam</em> gegangen sind.</h1>
      <p class="lede">Reisetagebücher von Renate und Chris – Tag für Tag, mit dem, was wir gesehen, gegessen und nachgelesen haben.</p>
    </section>
    <section class="r-grid">${cards}</section>
    ${newsletter("reisen-allgemein")}
  </main>`;

  return page({
    title: "Reisen · Renate & Chris",
    desc: "Reisetagebücher von Renate Leeb und Chris H. Leeb – Etappe für Etappe, mit Fotografien und Hintergründen.",
    canonical: `https://${site.domain}/reisen`,
    extraHead: `<link rel="stylesheet" href="/reisen.css">`,
    body,
  });
}

/* ---------- Einstieg ---------- */

export function buildReisen(ctx) {
  const { ROOT, DIST } = ctx;
  const file = path.join(ROOT, "reisen.json");
  if (!fs.existsSync(file)) {
    console.log("· reisen.json fehlt – Reise-Seiten übersprungen");
    return 0;
  }

  const { trips } = JSON.parse(fs.readFileSync(file, "utf8"));
  const css = path.join(ROOT, "src", "reisen.css");
  if (fs.existsSync(css)) fs.copyFileSync(css, path.join(DIST, "reisen.css"));
  karteAssets(ROOT, DIST);

  const counts = {};
  let total = 0;

  for (const t of trips) {
    const days = readTrip(ROOT, t);
    counts[t.slug] = days.length;
    const dir = path.join(DIST, "reise", t.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildTrip(t, days, ctx));
    for (const d of days) {
      fs.writeFileSync(path.join(dir, `${d.slug}.html`), buildDay(d, days, ctx));
      total++;
    }
  }

  fs.writeFileSync(path.join(DIST, "reisen.html"), buildIndex(trips, counts, ctx));
  return total;
}
