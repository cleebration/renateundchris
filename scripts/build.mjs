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
    <div class="cr">© ${year} Renate &amp; Chris Leeb · ${site.domain} · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a></div>
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
  const pairs = b.contributors.map((c) => `${c.person}:${c.role}`).join(" ");
  const by = b.author && b.type !== "roman" && b.type !== "kinderbuch"
    ? `von ${esc(b.author)}` : contributors(b);
  return `<a class="card" href="/buch/${b.slug}"
      data-persons="${persons}" data-roles="${roles}" data-pairs="${pairs}" data-type="${b.type}">
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
    <a class="pg pg-back" href="/">
      <span class="pg-dir">← Übersicht</span>
      <span class="pg-title">Alle Bücher</span>
    </a>
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
    <a class="pg pg-back" href="/">
      <span class="pg-dir">← Übersicht</span>
      <span class="pg-title">Alle Bücher</span>
    </a>
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

/* ---------- legal pages ---------- */
function legalShell(title, subtitle, inner) {
  return `<main class="wrap detailwrap">
    <a class="pg pg-back" href="/">
      <span class="pg-dir">← Übersicht</span>
      <span class="pg-title">Alle Bücher</span>
    </a>
    <section class="legal">
      <h1>${title}</h1>
      <p class="legal-sub">${subtitle}</p>
      ${inner}
    </section>
  </main>`;
}
const LEGAL_NAME = "Chris H. Leeb";
const LEGAL_ADDR = "Willingerstraße 17, 4030 Linz, Österreich";
const LEGAL_MAIL = "renateundchris@cleebration.com";
const MONTHS_DE = ["Jänner","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const STAND = `${MONTHS_DE[new Date().getMonth()]} ${new Date().getFullYear()}`;

function buildImpressum() {
  const inner = `
    <h2>Medieninhaber &amp; verantwortlich für den Inhalt</h2>
    <p>${LEGAL_NAME}<br>Willingerstraße 17<br>4030 Linz<br>Österreich</p>

    <h2>Kontakt</h2>
    <p>E-Mail: <a href="mailto:${LEGAL_MAIL}">${LEGAL_MAIL}</a></p>

    <h2>Art der Website</h2>
    <p>renateundchris.com ist die private Website von Renate Leeb und Chris H. Leeb. Sie stellt ihre gemeinsamen und einzelnen Buchprojekte vor (Bildbände, ein Roman, ein Kinderbuch sowie eine herausgegebene Lebensgeschichte). Der Kauf der Bücher erfolgt ausschließlich über externe Buchhandlungen und Plattformen (z. B. die örtliche Buchhandlung über genialokal oder Books on Demand). Auf dieser Website selbst werden keine Waren verkauft und keine Zahlungen abgewickelt.</p>

    <h2>Blattlinie (§ 25 MedienG)</h2>
    <p>Die Website informiert über die Buchprojekte von Renate Leeb und Chris H. Leeb sowie über damit verbundene Themen. Die Beiträge geben die persönliche Auffassung der Betreiber wieder.</p>

    <h2>Urheberrecht</h2>
    <p>Die Inhalte dieser Website (Texte, Fotografien, Cover-Abbildungen, Gestaltung) sind urheberrechtlich geschützt. Die Fotografien stammen von Renate Leeb, die Texte von Chris H. Leeb; die Rechte an den Cover-Abbildungen liegen bei den jeweiligen Urheber:innen bzw. beim Verlag (Books on Demand). Eine Verwertung außerhalb der gesetzlich erlaubten Fälle bedarf der vorherigen Zustimmung.</p>

    <h2>Haftung für Inhalte</h2>
    <p>Die Inhalte wurden mit größter Sorgfalt erstellt. Für ihre Richtigkeit, Vollständigkeit und Aktualität wird jedoch keine Gewähr übernommen.</p>

    <h2>Haftung für Links</h2>
    <p>Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte kein Einfluss besteht. Für diese fremden Inhalte wird keine Gewähr übernommen; verantwortlich ist stets der jeweilige Anbieter der verlinkten Seiten.</p>

    <h2>Online-Streitbeilegung</h2>
    <p>Da auf dieser Website keine Verträge mit Verbraucherinnen und Verbrauchern geschlossen werden, besteht keine Verpflichtung zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle.</p>`;
  return page({
    title: "Impressum · Renate & Chris",
    desc: "Impressum und Offenlegung gemäß § 5 ECG und § 25 Mediengesetz.",
    canonical: `https://${site.domain}/impressum`,
    body: legalShell("Impressum", "Angaben gemäß § 5 ECG (E-Commerce-Gesetz) und § 25 Mediengesetz (Österreich)", inner),
  });
}

function buildDatenschutz() {
  const inner = `
    <h2>1. Verantwortlicher</h2>
    <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br>
    ${LEGAL_NAME}, ${LEGAL_ADDR} · <a href="mailto:${LEGAL_MAIL}">${LEGAL_MAIL}</a></p>

    <h2>2. Grundsätzliches</h2>
    <p>Der Schutz deiner persönlichen Daten ist uns wichtig. Wir verarbeiten personenbezogene Daten nur im notwendigen Umfang und auf Grundlage der gesetzlichen Bestimmungen. Diese Erklärung informiert dich über Art, Umfang und Zweck der Verarbeitung sowie über deine Rechte.</p>

    <h2>3. Hosting (Cloudflare)</h2>
    <p>Diese Website wird über Cloudflare (Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA) bereitgestellt und ausgeliefert. Beim Aufruf werden in Server-Logfiles automatisch Daten wie die (gekürzte) IP-Adresse, Datum und Uhrzeit, die aufgerufene Datei, Browsertyp, Betriebssystem und Referrer-URL verarbeitet. Diese Daten dienen ausschließlich dem technischen Betrieb, der Auslieferung und der Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO). Da Cloudflare Daten auch in den USA verarbeiten kann, stützt sich die Übermittlung auf die EU-Standardvertragsklauseln. Details: <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener">cloudflare.com/privacypolicy</a>.</p>

    <h2>4. Schriftarten (Google Fonts)</h2>
    <p>Zur einheitlichen Darstellung bindet diese Website die Schriftarten „Fraunces" und „Spline Sans Mono" über Google Fonts ein. Beim Aufruf der Seite wird dabei deine IP-Adresse an Server von Google (Google Ireland Limited bzw. Google LLC, USA) übertragen, damit die Schriften geladen werden können (Art. 6 Abs. 1 lit. f DSGVO – einheitliche, ansprechende Darstellung). Die Übermittlung in die USA stützt sich auf die EU-Standardvertragsklauseln. Mehr dazu: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>.</p>

    <h2>5. Cookies / Speicherung</h2>
    <p>Diese Website verwendet ausschließlich technisch notwendige Mechanismen. Es werden keine Tracking- oder Marketing-Cookies gesetzt und keine Analyse-Dienste eingebunden.</p>

    <h2>6. Newsletter</h2>
    <p>Dieser Abschnitt gilt, sobald der Newsletter aktiv ist. Solange das Anmeldeformular keine Daten an einen Dienst übermittelt, findet keine Verarbeitung statt. Bei Aktivierung verarbeiten wir deine E-Mail-Adresse, den Anmeldezeitpunkt und die Anmelde-IP zum Versand des Newsletters – auf Grundlage deiner Einwilligung im Double-Opt-in-Verfahren (Art. 6 Abs. 1 lit. a DSGVO). Ein Widerruf ist jederzeit über den Abmeldelink in jeder E-Mail möglich. Als Versanddienst kommt EmailOctopus zum Einsatz (<a href="https://emailoctopus.com/legal/privacy" target="_blank" rel="noopener">emailoctopus.com/legal/privacy</a>).</p>

    <h2>7. Kontaktaufnahme</h2>
    <p>Wenn du uns per E-Mail kontaktierst, verarbeiten wir deine Angaben zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. f DSGVO). Die Daten werden gelöscht, sobald sie nicht mehr benötigt werden.</p>

    <h2>8. Externe Links</h2>
    <p>Diese Website verlinkt auf externe Seiten – etwa Buchhandlungen und Plattformen für den Buchkauf (genialokal, Books on Demand), <a href="${site.social.cleebration}" target="_blank" rel="noopener">cleebration.com</a>, <a href="${site.social.renatePhotos}" target="_blank" rel="noopener">renateleeb.photos</a> sowie Social-Media-Profile. Beim Anklicken gelangst du auf Seiten Dritter, für deren Datenverarbeitung der jeweilige Anbieter verantwortlich ist. Die Verweise sind reine Verlinkungen und laden keine Tracking-Skripte.</p>

    <h2>9. Deine Rechte</h2>
    <p>Dir stehen nach der DSGVO folgende Rechte zu:</p>
    <ul>
      <li>Auskunft über deine verarbeiteten Daten (Art. 15)</li>
      <li>Berichtigung unrichtiger Daten (Art. 16)</li>
      <li>Löschung (Art. 17)</li>
      <li>Einschränkung der Verarbeitung (Art. 18)</li>
      <li>Datenübertragbarkeit (Art. 20)</li>
      <li>Widerspruch gegen die Verarbeitung (Art. 21)</li>
      <li>Widerruf erteilter Einwilligungen (Art. 7 Abs. 3)</li>
    </ul>
    <p>Zur Ausübung genügt eine Nachricht an die oben genannte E-Mail-Adresse.</p>

    <h2>10. Beschwerderecht</h2>
    <p>Wenn du der Ansicht bist, dass die Verarbeitung deiner Daten gegen das Datenschutzrecht verstößt, kannst du dich bei der österreichischen Datenschutzbehörde beschweren: Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien — <a href="https://www.dsb.gv.at" target="_blank" rel="noopener">www.dsb.gv.at</a></p>

    <h2>11. Aktualität</h2>
    <p>Diese Datenschutzerklärung wird angepasst, sobald sich die Datenverarbeitung ändert (z. B. bei Aktivierung des Newsletters). Stand: ${STAND}</p>`;
  return page({
    title: "Datenschutz · Renate & Chris",
    desc: "Datenschutzerklärung gemäß DSGVO und österreichischem Datenschutzgesetz.",
    canonical: `https://${site.domain}/datenschutz`,
    body: legalShell("Datenschutzerklärung", "Gemäß Datenschutz-Grundverordnung (DSGVO) und österreichischem Datenschutzgesetz (DSG)", inner),
  });
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
fs.writeFileSync(path.join(DIST, "impressum.html"), buildImpressum());
fs.writeFileSync(path.join(DIST, "datenschutz.html"), buildDatenschutz());
for (const b of books) {
  fs.writeFileSync(path.join(DIST, "buch", `${b.slug}.html`), buildBook(b));
}

console.log(`✓ Build fertig: ${books.length} Buchseiten + Übersicht + Über-uns in /dist`);
