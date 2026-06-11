// Lightweight static site generator – keine Abhängigkeiten, nur Node.
// Erzeugt aus books.json:  dist/index.html  +  dist/buch/<slug>.html  (eine URL pro Buch)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "books.json"), "utf8"));
const { site, people, roleLabels, typeLabels, books } = data;
const bySlug = (s) => books.find((b) => b.slug === s);

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eur = (n) => "€\u00a0" + Number(n).toFixed(2).replace(".", ",");

function contributors(b) {
  return b.contributors
    .map((c) => `${people[c.person]} · ${roleLabels[c.role]}`)
    .join("  ·  ");
}
function priceLabel(b) {
  let s = "ab " + eur(b.price) + " · BoD";
  return s;
}
function cover(b, cls) {
  if (b.cover) {
    return `<img src="${esc(b.cover)}" alt="Cover: ${esc(b.title)}" loading="lazy"
      onerror="this.outerHTML='<div class=&quot;fallback&quot; style=&quot;background:${b.accent}&quot;>${esc(b.title)}</div>'">`;
  }
  return `<div class="fallback" style="background:${b.accent}">${esc(b.title)}</div>`;
}
function accentStyle(b) {
  return `--accent:${b.accent};--accent-ink:${b.accentInk};--wash:${b.wash}`;
}

const HEAD_FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Spline+Sans+Mono:wght@400;500&display=swap" rel="stylesheet">`;

function masthead(rel = "") {
  return `<header class="mast"><div class="wrap mast-row">
    <a class="brand" href="/">Renate&nbsp;<span>&amp;</span>&nbsp;Chris</a>
    <nav class="mast-nav">
      <a href="/">Bücher</a>
      <a href="/ueber-uns">Über uns</a>
      <a href="${site.social.renatePhotos}" target="_blank" rel="noopener">Renates Fotografie</a>
      <a href="${site.social.cleebration}" target="_blank" rel="noopener">cleebration</a>
    </nav>
  </div></header>`;
}

function newsletter(tag) {
  return `<section class="news"><div class="inner">
    <div>
      <div class="eyebrow" style="color:rgba(236,238,236,.7)">Newsletter</div>
      <h2>Erfahre, wenn das nächste Buch erscheint.</h2>
      <p>Neue Bücher, Lesungen und Hintergründe – kein Spam, jederzeit abbestellbar.</p>
    </div>
    <div>
      <!-- EmailOctopus: action + Feldnamen aus dem Embed-Code deiner Liste einsetzen -->
      <form class="nl-form" action="${site.newsletterAction}" method="post" target="_blank">
        <input type="email" name="email_address" placeholder="deine@e-mail.at" aria-label="E-Mail-Adresse" required>
        <input type="hidden" name="tag" value="${esc(tag)}">
        <button type="submit">Anmelden</button>
      </form>
      <div class="nl-tag">Interesse-Tag: ${esc(tag)}</div>
    </div>
  </div></section>`;
}

function footer(rel = "") {
  const year = new Date().getFullYear();
  return `<footer class="site wrap">
    <div class="soc">
      <a href="${site.social.instagram}" target="_blank" rel="noopener">Instagram</a>
      <a href="${site.social.facebook}" target="_blank" rel="noopener">Facebook</a>
      <a href="${site.social.renatePhotos}" target="_blank" rel="noopener">renateleeb.photos</a>
      <a href="${site.social.cleebration}" target="_blank" rel="noopener">cleebration.com</a>
    </div>
    <div class="cr">© ${year} Renate &amp; Chris Leeb · ${site.domain}</div>
  </footer>`;
}

function page({ title, desc, body, rel = "", bodyStyle = "", image = "", canonical = "", extraHead = "" }) {
  return `<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">${image ? `\n<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
${HEAD_FONTS}
<link rel="stylesheet" href="/styles.css">
${extraHead}
</head><body${bodyStyle ? ` style="${bodyStyle}"` : ""}>
${masthead(rel)}
${body}
${footer(rel)}
</body></html>`;
}

/* ---------- index / catalog ---------- */
function chip(dim, value, label, pressed) {
  return `<button class="chip" data-value="${value}" aria-pressed="${pressed ? "true" : "false"}">${label}</button>`;
}
function filterbar() {
  const personChips =
    chip("person", "alle", "Alle", true) +
    chip("person", "chris", "Chris H. Leeb") +
    chip("person", "renate", "Renate Leeb");
  const roleChips =
    chip("role", "alle", "Alle", true) +
    Object.entries(roleLabels).map(([v, l]) => chip("role", v, l)).join("");
  const typeChips =
    chip("type", "alle", "Alle", true) +
    Object.entries(typeLabels).map(([v, l]) => chip("type", v, l)).join("");
  return `<div class="filterbar">
    <div class="fgroup"><span class="flabel">Person</span><div class="chips" data-dim="person">${personChips}</div></div>
    <div class="fgroup"><span class="flabel">Rolle</span><div class="chips" data-dim="role">${roleChips}</div></div>
    <div class="fgroup"><span class="flabel">Typ</span><div class="chips" data-dim="type">${typeChips}</div></div>
    <div class="fmeta" id="fmeta"></div>
  </div>`;
}
function card(b) {
  const persons = b.contributors.map((c) => c.person).join(" ");
  const roles = b.contributors.map((c) => c.role).join(" ");
  const by = b.author && b.type !== "roman" && b.type !== "kinderbuch"
    ? `von ${esc(b.author)}` : contributors(b);
  return `<a class="card" href="/buch/${b.slug}"
      data-persons="${persons}" data-roles="${roles}" data-type="${b.type}">
    <div class="frame">${cover(b)}</div>
    <div class="c-meta">
      <span class="c-kicker"><span class="c-dot" style="background:${b.accent}"></span>${esc(typeLabels[b.type])}</span>
      <span class="c-title">${esc(b.title)}</span>
      <span class="c-by">${by}</span>
      <span class="c-price">${priceLabel(b)}</span>
    </div>
  </a>`;
}
function buildIndex() {
  const body = `<main class="wrap">
    <section class="hero">
      <div class="eyebrow">${books.length} Bücher · ein Regal</div>
      <h1>Geschichten, die <em>quer</em> denken, <em>rund</em> erzählen und <em>tief</em> gehen.</h1>
      <p class="lede">Bücher von Renate Leeb und Chris H. Leeb – Bildbände, ein Roman, ein Kinderbuch und eine herausgegebene Lebensgeschichte. Filtere nach Person, Rolle oder Buchtyp.</p>
    </section>
    ${filterbar()}
    <section class="shelf">${books.map(card).join("")}</section>
    ${newsletter("newsletter-allgemein")}
  </main>
  <script src="/app.js" defer></script>`;
  return page({
    title: "Bücher · Renate & Chris",
    desc: "Alle Bücher von Renate Leeb und Chris H. Leeb – filterbar nach Person, Rolle und Typ.",
    canonical: `https://${site.domain}/`,
    body,
  });
}

/* ---------- book detail ---------- */
function shopButtons(b) {
  const primary = `<a class="buy primary" href="${esc(b.bodUrl)}" target="_blank" rel="noopener">Books on Demand <small>günstigster Preis</small></a>`;
  const rest = (b.shops || [])
    .map((s) => `<a class="buy" href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.n)}</a>`)
    .join("");
  const local = `<a class="buy ghost" href="${esc(b.genialokal || "https://www.genialokal.de/")}" target="_blank" rel="noopener">Deine Buchhandlung <small>vor Ort</small></a>`;
  return primary + rest + local;
}
function relatedBlock(b) {
  const items = (b.related || []).map((slug) => {
    const r = bySlug(slug);
    if (!r) return "";
    return `<a class="rel" href="/buch/${r.slug}">
      <span class="sw" style="background:${r.accent}"></span>
      <span><span class="rt">${esc(r.title)}</span><br><span class="rty">${esc(typeLabels[r.type])}</span></span>
    </a>`;
  }).join("");
  return `<section class="related"><div class="h">Das könnte dir auch gefallen</div><div class="rel-grid">${items}</div></section>`;
}
function metaRow(b) {
  const rows = [
    ["ISBN", b.isbn],
    b.isbnEbook ? ["ISBN E-Book", b.isbnEbook] : null,
    ["Format", b.format],
    ["Erschienen", b.year],
    ["Preis", "ab " + eur(b.price) + (b.priceEbook ? " · E-Book " + eur(b.priceEbook) : "")],
  ].filter(Boolean);
  return `<dl class="meta">${rows.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${esc(dd)}</dd></div>`).join("")}</dl>`;
}
function bookNav(b) {
  const idx = books.findIndex((x) => x.slug === b.slug);
  const prev = books[(idx - 1 + books.length) % books.length];
  const next = books[(idx + 1) % books.length];
  return `<nav class="bookbar" aria-label="Buch-Navigation">
    <a class="back" href="/">← Alle Bücher</a>
    <div class="pager">
      <a class="pg pg-prev" href="/buch/${prev.slug}" title="${esc(prev.title)}">
        <span class="pg-dir">← Voriges</span>
        <span class="pg-title">${esc(prev.title)}</span>
      </a>
      <a class="pg pg-next" href="/buch/${next.slug}" title="${esc(next.title)}">
        <span class="pg-dir">Nächstes →</span>
        <span class="pg-title">${esc(next.title)}</span>
      </a>
    </div>
  </nav>`;
}
function buildBook(b) {
  const tag = b.type === "bildband" ? "bildband-" + b.slug : b.type;
  const body = `<main class="wrap detailwrap">
    ${bookNav(b)}
    <article class="detail">
      <div class="cover">${cover(b)}</div>
      <div>
        <div class="d-eyebrow">
          <span class="badge">${esc(typeLabels[b.type])}</span>
          <span class="contribs">${contributors(b)}</span>
        </div>
        <h1>${esc(b.title)}</h1>
        <p class="sub">${esc(b.subtitle || "")}${b.author && b.type === "biografie" ? " · von " + esc(b.author) : ""}</p>
        <p class="blurb">${esc(b.blurb)}</p>
        <div class="buy-label">Überall erhältlich</div>
        <div class="buys">${shopButtons(b)}</div>
        ${metaRow(b)}
        <div class="origin"><div class="h">Wie alles begann</div><p>${esc(b.origin)}</p></div>
      </div>
    </article>
    ${relatedBlock(b)}
    ${newsletter(tag)}
  </main>`;
  return page({
    title: `${b.title} · Renate & Chris`,
    desc: b.blurb,
    rel: "../",
    bodyStyle: accentStyle(b),
    image: b.cover ? (b.cover.startsWith("http") ? b.cover : `https://${site.domain}${b.cover}`) : "",
    canonical: `https://${site.domain}/buch/${b.slug}`,
    body,
  });
}

/* ---------- simple about page ---------- */
function buildAbout() {
  const body = `<main class="wrap detailwrap">
    <a class="back" href="/">← Alle Bücher</a>
    <section class="about">
      <div class="eyebrow">Über uns</div>
      <h1>Renate &amp; Chris</h1>
      <p class="lede">Wir machen gemeinsam Bücher, in denen Bild und Text einander suchen: Renates Fotografien und Chris’ Worte, nebeneinander, im Gespräch.</p>
      <div class="about-person">
        <h2>Renate</h2>
        <p>Renate unterrichtet seit über zwanzig Jahren Mathematik und Psychologie/Philosophie – das Beweisbare und das, was sich dem Beweis entzieht, gehören für sie zusammen. Mit der Kamera geht sie genauso durchs Leben: neugierig, mit offenen Augen, bereit, am Wegrand, an einer Mauer oder am Himmel das Kleine zu entdecken, an dem die meisten vorbeigehen.</p>
        <p class="about-link"><a href="${site.social.renatePhotos}">→ Mehr von Renate: renateleeb.photos</a></p>
      </div>
      <div class="about-person">
        <h2>Chris</h2>
        <p>Chris ist Unternehmer und Keynote-Speaker und steht genauso gern auf der Konzert- wie auf der Vortragsbühne – Musik begleitet ihn, seit er denken kann. In seinen Texten verbindet er beides: den Blick fürs große Muster und die Freude am einzelnen Ton.</p>
        <p class="about-link"><a href="${site.social.cleebration}">→ Chris solo: cleebration.com</a></p>
      </div>
      <p class="about-close">Was uns verbindet, ist eine Überzeugung: Die meisten Wunder stecken im Alltäglichen – man muss nur hinsehen.</p>
    </section>
    ${newsletter("newsletter-allgemein")}
  </main>`;
  return page({ title: "Über uns · Renate & Chris", desc: "Renate Leeb und Chris H. Leeb – gemeinsam machen wir Bücher, in denen Bild und Text einander suchen.", canonical: `https://${site.domain}/ueber-uns`, body });
}

/* ---------- write ---------- */
function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
rmrf(DIST);
fs.mkdirSync(path.join(DIST, "buch"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(ROOT, "src", "app.js"), path.join(DIST, "app.js"));
// Cover/Assets mitliefern
if (fs.existsSync(path.join(ROOT, "assets"))) {
  fs.cpSync(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });
}
// tools mitliefern (Formular zum Bücher-Hinzufügen)
if (fs.existsSync(path.join(ROOT, "tools"))) {
  fs.cpSync(path.join(ROOT, "tools"), path.join(DIST, "tools"), { recursive: true });
}
fs.writeFileSync(path.join(DIST, "index.html"), buildIndex());
fs.writeFileSync(path.join(DIST, "ueber-uns.html"), buildAbout());
for (const b of books) {
  fs.writeFileSync(path.join(DIST, "buch", `${b.slug}.html`), buildBook(b));
}

console.log(`✓ Build fertig: ${books.length} Buchseiten + Übersicht + Über-uns in /dist`);
