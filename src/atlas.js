/* Reise-Atlas – Bildschirm + Smartphone-Controller.
   Kopplung: Bildschirm und Smartphone treffen sich über zwei öffentliche MQTT-Broker unter „rcatlas/v1/<code>/…“; das Smartphone öffnet
   /atlas/#c-<code> (QR-Code). Keine Anmeldung, kein eigener Server. */
(function () {
  "use strict";
  const APP = document.getElementById("app");
  const REISE = APP.dataset.reise;
  const TITLE = APP.dataset.title;
  const PEER_PREFIX = "rcatlas-";

  const COUNTRY = {AT:{n:"Österreich",c:"#c9b38a"},SI:{n:"Slowenien",c:"#b9c08a"},HR:{n:"Kroatien",c:"#7fb7c9"},ME:{n:"Montenegro",c:"#a68fc2"},AL:{n:"Albanien",c:"#d86b5a"},GR:{n:"Griechenland",c:"#6fa0d8"},MK:{n:"Nordmazedonien",c:"#e0b13a"},RS:{n:"Serbien",c:"#9aa65a"},
    BA:{n:"Bosnien und Herzegowina",c:"#c98f6a"},XK:{n:"Kosovo",c:"#8fb3a0"},BG:{n:"Bulgarien",c:"#b98fb0"},RO:{n:"Rumänien",c:"#d9a05b"},HU:{n:"Ungarn",c:"#a7c07a"},SK:{n:"Slowakei",c:"#8aa8c9"},CZ:{n:"Tschechien",c:"#c97f7f"},PL:{n:"Polen",c:"#d4b05e"},
    DE:{n:"Deutschland",c:"#b0a090"},CH:{n:"Schweiz",c:"#d97a6a"},IT:{n:"Italien",c:"#7fb08a"},FR:{n:"Frankreich",c:"#7f9ad0"},ES:{n:"Spanien",c:"#e0a050"},PT:{n:"Portugal",c:"#90b070"},TR:{n:"Türkei",c:"#d0706a"},NL:{n:"Niederlande",c:"#e09a50"},
    BE:{n:"Belgien",c:"#c0b060"},LU:{n:"Luxemburg",c:"#90a0c0"},DK:{n:"Dänemark",c:"#d08080"},NO:{n:"Norwegen",c:"#80a0c8"},SE:{n:"Schweden",c:"#7fa8d8"},FI:{n:"Finnland",c:"#a0c0d8"},GB:{n:"Großbritannien",c:"#a090c0"},IE:{n:"Irland",c:"#80b080"}};
  const THEMEN = [["geschichte","Geschichte"],["habsburg","Österreich-Bezug"],["mythencheck","Legenden"],["kulinarik","Essen"],["kloster","Klöster"],["burg","Burgen"],["natur","Natur"],["strand","Strand"],["grenze","Grenzen"],["panne","Pannen"],["eisenbahn","Eisenbahn"],["faehre","Fähren"]];
  const ROLLEN = {
    zuschauer:{n:"Zuschauer",k:"im Flug",d:"Die ganze Route am Stück. Nur Orte und ein Satz pro Tag.",s:{tempo:7,breite:1,tiefe:1,thema:null,play:true}},
    entdecker:{n:"Entdecker",k:"frei",d:"Selbst fahren, anhalten, jede Station öffnen.",s:{tempo:3,breite:3,tiefe:2,thema:null,play:false}},
    zeitreisender:{n:"Zeitreisender",k:"Geschichte",d:"Durch die Schichten: Antike, Osmanen, Habsburg.",s:{tempo:3,breite:2,tiefe:3,thema:"geschichte",play:false}},
    geniesser:{n:"Genießer",k:"Kulinarik",d:"Lokale, Gerichte und woher sie kommen.",s:{tempo:5,breite:3,tiefe:2,thema:"kulinarik",play:false}},
    abenteurer:{n:"Abenteurer",k:"Pannen & Grenzen",d:"Offroad, Reifen, Staus – die ehrliche Seite.",s:{tempo:5,breite:3,tiefe:2,thema:"panne",play:false}},
    wien:{n:"Österreich-Spurensucher",k:"Quest",d:"Folge den Fäden, die von hier nach Österreich führen.",s:{tempo:5,breite:2,tiefe:3,thema:"habsburg",play:false}}
  };
  // Tempo 1–10 wie ein Tacho: Name, Farbe (grün → gelb → rot) und Zeitfaktor je Stufe
  const TEMPO = ["Stopp", "Schritttempo", "sehr langsam", "langsam", "gemächlich", "mittel", "zügig", "schnell", "sehr schnell", "rasant", "Vollgas"];
  const TMAX = 10;
  const tempoFarbe = (t) => t <= 0 ? "#f3ecdc" : `hsl(${Math.round(130 - (t - 1) * 14.4)} 72% 52%)`;
  const tz = (ms, t) => Math.round(ms * Math.pow(0.7, t - 5)); // Basis = Stufe 5 „mittel“
  // Tacho: 0 = steht (weiß), 1–10 = Fahrstufe. Wird einmal gebaut und dann nur aktualisiert, damit die Nadel schwenkt.
  const tachoSvg = (v, gross) => { const r = 20, cx = 24, cy = 24; let bog = "";
    for (let i = 0; i < TMAX; i++) { const w0 = Math.PI + i / TMAX * Math.PI, w1 = Math.PI + (i + 1) / TMAX * Math.PI - 0.06;
      bog += `<path d="M${cx + r * Math.cos(w0)} ${cy + r * Math.sin(w0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(w1)} ${cy + r * Math.sin(w1)}" stroke="${tempoFarbe(i + 1)}" stroke-width="5" fill="none" opacity="${i < v ? 1 : .25}"/>`; }
    return `<svg class="tacho${gross ? " gross" : ""}" viewBox="0 0 48 28" aria-hidden="true">${bog}<g class="nadel" style="transform:rotate(${-90 + v / TMAX * 180}deg)"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 16}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></g><circle cx="${cx}" cy="${cy}" r="3" fill="currentColor"/></svg>`; };
  const tachoSetzen = (el, v, gross) => { let svg = el.querySelector("svg.tacho"); if (!svg) { el.insertAdjacentHTML("afterbegin", tachoSvg(v, gross)); return; }
    [...svg.querySelectorAll("path")].forEach((pa, i) => pa.setAttribute("opacity", i < v ? 1 : .25)); svg.querySelector(".nadel").style.transform = `rotate(${-90 + v / TMAX * 180}deg)`; };
  const KAMERA = [["nord","Nord"],["fahrt","Fahrt"],["frei","Frei"]];
  const VORLESEN = [["aus","aus"],["chris","Chris"],["renate","Renate"],["abwechselnd","abwechselnd"],["zufall","zufällig"]];
  const SPRECHER = { chris: "Chris", renate: "Renate" };
  // Fahrzeuge von oben (wie die Auto-Markierung bei Navi-Karten). Spitze = vorne = oben, gedreht wird in Fahrtrichtung.
  // Je Reise: reisen.json „fahrzeugTyp“; je Tag abweichend: _atlas.json tage[].fahrzeug (z. B. "mietauto").
  const FAHRZEUGE = {
    l3: { n: "Peugeot Traveller L3", form: "bus", lack: "#17191c", dach: "#2c3136", rand: "#f3ecdc", w: 30, h: 70 },
    l2: { n: "Peugeot Traveller L2", form: "bus", lack: "#e2702a", dach: "#f2954f", rand: "#1b1206", w: 30, h: 63 },
    mietauto: { n: "Mietauto", form: "pkw", lack: "#d6dade", dach: "#f1f3f5", rand: "#16262c", w: 27, h: 56 },
  };
  const FZ_GROESSE = 0.6; // Fahrzeug auf der Karte kleiner darstellen
  function fahrzeugSvg(k) {
    const f = FAHRZEUGE[k] || FAHRZEUGE.l3, W = 40, H = Math.round(f.h / f.w * 40), glas = "#8fb8cc";
    if (f.form === "pkw") return `<svg viewBox="0 0 ${W} ${H}" width="${Math.round(f.w * FZ_GROESSE)}" height="${Math.round(f.h * FZ_GROESSE)}" aria-hidden="true">
      <rect x="2" y="2" width="36" height="${H - 4}" rx="11" fill="${f.lack}" stroke="${f.rand}" stroke-width="2"/>
      <path d="M8 ${H * .28} Q20 ${H * .22} 32 ${H * .28} L30 ${H * .38} Q20 ${H * .35} 10 ${H * .38}Z" fill="${glas}"/>
      <rect x="9" y="${H * .4}" width="22" height="${H * .27}" rx="4" fill="${f.dach}"/>
      <path d="M10 ${H * .7} Q20 ${H * .73} 30 ${H * .7} L31 ${H * .78} Q20 ${H * .8} 9 ${H * .78}Z" fill="${glas}"/>
      <rect x="0" y="${H * .3}" width="3" height="5" rx="1" fill="${f.lack}"/><rect x="37" y="${H * .3}" width="3" height="5" rx="1" fill="${f.lack}"/>
      <rect x="7" y="4" width="6" height="3" rx="1.5" fill="#fff6d8"/><rect x="27" y="4" width="6" height="3" rx="1.5" fill="#fff6d8"/></svg>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="${Math.round(f.w * FZ_GROESSE)}" height="${Math.round(f.h * FZ_GROESSE)}" aria-hidden="true">
      <rect x="3" y="2" width="34" height="${H - 4}" rx="8" fill="${f.lack}" stroke="${f.rand}" stroke-width="2"/>
      <path d="M7 15 Q20 11 33 15 L32 24 Q20 22 8 24Z" fill="${glas}"/>
      <rect x="8" y="27" width="24" height="${H - 39}" rx="3" fill="${f.dach}"/>
      <line x1="11" y1="30" x2="11" y2="${H - 15}" stroke="${f.lack}" stroke-width="1.2" opacity=".6"/><line x1="29" y1="30" x2="29" y2="${H - 15}" stroke="${f.lack}" stroke-width="1.2" opacity=".6"/>
      <rect x="10" y="${H - 10}" width="20" height="4" rx="1.5" fill="${glas}" opacity=".8"/>
      <rect x="0" y="16" width="4" height="6" rx="1.5" fill="${f.lack}"/><rect x="36" y="16" width="4" height="6" rx="1.5" fill="${f.lack}"/>
      <rect x="8" y="4" width="6" height="3" rx="1.5" fill="#fff6d8"/><rect x="26" y="4" width="6" height="3" rx="1.5" fill="#fff6d8"/></svg>`;
  }
  const merk = { get(k, d) { try { const v = localStorage.getItem("atlas." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
                 set(k, v) { try { localStorage.setItem("atlas." + k, JSON.stringify(v)); } catch (e) {} } };
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("de-AT", {weekday:"short", day:"2-digit", month:"2-digit"}); };
  const themaName = (k) => (THEMEN.find((t) => t[0] === k) || [0, k])[1];

  // ---------- Modus ----------
  const hashCode = (/^#c-([a-z0-9]{4,8})$/.exec(location.hash) || [])[1];
  const narrow = Math.min(screen.width, screen.height) < 600;
  if (hashCode) startController(hashCode);
  else startScreen();

  function chooseMode() {
    APP.insertAdjacentHTML("beforeend", `<div class="choose"><div class="in">
      <h2>Reise-Atlas</h2><p>Am besten am Mac oder Fernseher ansehen und mit dem Smartphone steuern (iPhone oder Android). Am Bildschirm steht ein QR-Code und ein Code aus sechs Zeichen.</p>
      <label for="codeIn" class="note">Code vom Bildschirm</label>
      <input id="codeIn" inputmode="text" autocomplete="off" autocapitalize="none" maxlength="6" placeholder="abc123">
      <button class="big primary" id="asCtl">Verbinden<small>Smartphone als Controller</small></button>
      <span class="err" id="codeErr" hidden>Der Code hat sechs Zeichen (Buchstaben und Ziffern).</span>
      <button class="big" id="asScreen">Hier ansehen<small>ohne zweites Gerät</small></button></div></div>`);
    const go = () => { const v = document.getElementById("codeIn").value.trim().toLowerCase(); if (!/^[a-z0-9]{6}$/.test(v)) { document.getElementById("codeErr").hidden = false; return; } location.hash = "#c-" + v; location.reload(); };
    document.getElementById("asCtl").onclick = go;
    document.getElementById("codeIn").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    document.getElementById("asScreen").onclick = () => { document.querySelector(".choose").remove(); if (!document.getElementById("screen")) startScreen(); };
  }

  // ---------- Polyline ----------
  function decode(p) {
    const pts = []; let i = 0, lat = 0, lng = 0;
    while (i < p.length) {
      for (let k = 0; k < 2; k++) {
        let shift = 0, res = 0, b;
        do { b = p.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
        const v = res & 1 ? ~(res >> 1) : res >> 1;
        if (k === 0) lat += v; else lng += v;
      }
      pts.push([lng / 1e5, lat / 1e5]);
    }
    return pts;
  }
  const d2 = (a, b) => { const dx = (a[0] - b[0]) * Math.cos(b[1] * Math.PI / 180), dy = a[1] - b[1]; return dx * dx + dy * dy; };

  // =========================================================== BILDSCHIRM
  async function startScreen() {
    APP.insertAdjacentHTML("beforeend", `<div id="screen">
      <div id="map" role="img" aria-label="Karte der Reiseroute ${esc(TITLE)}"></div>
      <div class="hud" id="hudTop">
        <div class="brandRow"><a class="backBtn" href="/atlas/" aria-label="Zurück zur Weltkugel mit allen Reisen">← Alle Reisen</a><a class="brand" href="/atlas/"><span class="eyebrow">Renate &amp; Chris · Reise-Atlas</span><h1>${esc(TITLE)}</h1></a></div>
        <div class="chips">
          <button class="chip warn" id="tonChip" hidden title="Der Browser hat den Ton blockiert">🔇 Ton einschalten</button>
          <span class="chip"><i class="dot" id="linkDot"></i><b id="linkTxt">Kein Smartphone verbunden</b></span>
          <button class="chip narrowOnly" id="tonBtn" aria-expanded="false">Kamera &amp; Ton</button>

          <a class="chip" href="/atlas/statistik/#${esc(REISE)}" title="Kilometer, Wetter, Rekorde und Abzeichen">📊 Statistik</a>

          <span class="chip opt">Legenden <b class="mono" id="chipMyth">0</b></span>
          <span class="chip opt">Österreich-Fäden <b class="mono" id="chipWien">0</b></span>
          <span class="chip opt"><b class="mono" id="chipKm">0</b> km</span>
        </div>
      </div>
      <button class="hud" id="kompass" aria-label="Karte nach Norden ausrichten"><span class="kn"><i></i><b></b></span></button>
      <div class="hud pad" id="navPad" role="slider" aria-label="Stationen und Tage: nach oben ziehen = weiter (weit = nächster Tag), nach unten = zurück; oben/unten tippen = Station vor/zurück"><span class="pA">▲</span><span class="pT">Stopp<br>·<br>Tag</span><span class="pA">▼</span></div>
      <div class="hud pad" id="tempoPad" role="slider" aria-label="Tempo: nach oben ziehen = schneller, nach unten = langsamer, tippen = Stopp/weiter"><i class="pF"></i><span class="pZ"></span></div>
      <div class="hud" id="dock" aria-label="Steuerung">
        <button data-a="dayPrev" aria-label="Tag zurück">«</button><button data-a="prev" aria-label="Station zurück">◀</button>
        <button data-a="play" class="primary" id="dPlay">▶ Fahren</button>
        <button data-a="next" aria-label="Station weiter">▶</button><button data-a="dayNext" aria-label="Tag weiter">»</button>
      </div>
      <div class="hud" id="side"><button class="sideKopf" id="sideKopf" aria-expanded="true"><span>Steuerung</span><i>‹</i></button>
        <div class="panel"><h4>Smartphone als Controller</h4>
          <div id="qrBox"><div id="qr" aria-label="QR-Code zum Controller"></div><p>Mit der Handy-Kamera scannen<br>oder Code eingeben:<br><b id="codeTxt">······</b></p></div></div>
        <div class="panel" id="tonPanel"><button class="sucheBtn" id="sucheBtn" title="Taste /">🔎 Suchen &amp; fragen</button><button class="uhrBtn" id="uhrBtn" aria-pressed="false">🕐 Uhr nach Fotozeiten</button><button class="uhrBtn" id="vollBtn">⛶ Vollbild</button><button class="fernBtn" id="fernBtn">📱 Dieses Gerät als Fernbedienung für einen anderen Bildschirm</button><h4>Tempo</h4>
          <div class="tachoBox"><span id="tachoGross"></span><div><b id="tempoTxt"></b><input type="range" id="tempoR" min="0" max="10" step="1" aria-label="Fahrstufe 0 (Stopp) bis 10 (Tasten − / +)"></div></div>
          <h4>Breite</h4>
          <div class="seg" style="--n:3" data-ks="breite"><button data-v="1">Highlights</button><button data-v="2">Stationen</button><button data-v="3">alles</button></div>
          <h4>Tiefe</h4>
          <div class="seg" style="--n:4" data-ks="tiefe"><button data-v="0" title="Ort">1</button><button data-v="1" title="Satz">2</button><button data-v="2" title="Teaser">3</button><button data-v="3" title="alles">4</button></div>
          <h4>Kamera</h4>
          <div class="seg" style="--n:3" data-ks="kamera">${KAMERA.map(([k, n]) => `<button data-v="${k}" title="${k === "nord" ? "Norden oben" : k === "fahrt" ? "Blick in Fahrtrichtung" : "selbst drehen"}">${n}</button>`).join("")}</div>
          <div id="musikBox" hidden><h4>Musik</h4><div class="seg" style="--n:2" data-ks="musik"><button data-v="aus">aus</button><button data-v="an">an</button></div><p class="note" id="musikInfo"></p></div>
          <div id="vlBox" hidden><h4>Vorlesen</h4><div class="seg vl" data-ks="vorlesen">${VORLESEN.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div><p class="note" id="vlInfo"></p></div>
        </div>
        <div class="panel"><h4>Tastatur</h4><div class="kbd"><kbd>←</kbd> <kbd>→</kbd> Station · <kbd>⇧</kbd>+Pfeil Tag<br><kbd>Leer</kbd> Fahren / Anhalten · <kbd>−</kbd> <kbd>+</kbd> Tempo<br><kbd>↓</kbd> tiefer <kbd>↑</kbd> weniger · <kbd>B</kbd> Breite · <kbd>T</kbd> Tageskarte · <kbd>F</kbd> Vollbild<br><kbd>/</kbd> Suchen &amp; fragen<br><kbd>K</kbd> Kamera · <kbd>M</kbd> Musik · <kbd>V</kbd> Vorlesen</div></div>
      </div>
      <aside class="hud" id="card" aria-live="polite"></aside>
      <div class="hud" id="uhr" hidden title="Uhrzeit aus den Aufnahmezeiten der Fotos, zwischen zwei Fotos geschätzt"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="2"/>${[...Array(12)].map((_, i) => `<line x1="20" y1="4" x2="20" y2="${i % 3 ? 6 : 8}" stroke="currentColor" stroke-width="${i % 3 ? 1 : 2}" transform="rotate(${i * 30} 20 20)"/>`).join("")}<line class="h" x1="20" y1="20" x2="20" y2="11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line class="m" x1="20" y1="20" x2="20" y2="6" stroke="var(--amber)" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="20" r="2" fill="currentColor"/></svg><div><b></b><small></small></div></div>
      <button class="hud" id="cardTab" hidden aria-label="Tagesübersicht einblenden">‹ Tag</button>
      <div class="hud" id="tempoBlase" hidden></div>
      <div class="hud" id="rail"><div id="railRow" role="group" aria-label="Reisetage"></div>
        <div id="railMeta"><span><b id="metaDay">Tag 1</b> · <span id="metaDate"></span> · <span id="metaMode"></span></span><span class="legend" id="legend"></span></div></div>
      <div id="roles" hidden><div class="rolesIn"><a class="backBtn rolesBack" href="/atlas/">← Zurück zu allen Reisen</a><h2>Wie willst du reisen?</h2>
        <p id="rolesLead">Wähle, wie viel du sehen willst – mit Maus, Tastatur oder dem Smartphone. Jederzeit wechselbar.</p>
        <div class="roleGrid" id="roleGrid"></div></div></div>
      <div id="lightbox" hidden role="dialog" aria-label="Foto groß"><button class="big" id="lbClose">Schließen</button><button class="lbNav" id="lbPrev" aria-label="Vorheriges Foto">‹</button><figure><img id="lbImg" alt=""><figcaption id="lbCap"></figcaption></figure><button class="lbNav" id="lbNext" aria-label="Nächstes Foto">›</button></div>
    </div>`);

    let DATA;
    try { DATA = await fetch(`/atlas/data/${REISE}.json?v=${APP.dataset.v || ""}`).then((r) => r.json()); }
    catch (e) { document.getElementById("card").innerHTML = "<p>Die Reisedaten konnten nicht geladen werden. Bitte Seite neu laden.</p>"; return; }
    const DAYS = DATA.tage;
    const dayOf = (t) => DAYS.find((d) => d.tag === t);
    const ccOf = (d) => (d && d.land && d.land[d.land.length - 1]) || "HR";
    const colOf = (d) => (COUNTRY[ccOf(d)] || {}).c || "#e0913a";

    // Routen dekodieren, Stationen auf die Route legen
    DAYS.forEach((d) => { d.line = d.route && d.route.poly ? decode(d.route.poly) : null; });
    const ST = [];
    DAYS.forEach((d) => {
      let from = 0;
      (d.stationen || []).forEach((s, i) => {
        if (typeof s.lat !== "number") return;
        const st = Object.assign({ day: d.tag, i }, s);
        if (d.line) { // nächster Punkt der Route ab dem letzten Treffer
          let best = from, bd = Infinity;
          for (let k = from; k < d.line.length; k++) { const dd = d2(d.line[k], [s.lon, s.lat]); if (dd < bd) { bd = dd; best = k; } }
          st.ri = best; from = best;
        }
        ST.push(st);
      });
    });
    const kmTotal = DAYS.reduce((a, d) => a + ((d.route && d.route.km) || 0), 0);
    { const nL = new Set(DAYS.flatMap((d) => d.land || [])).size; const fz = DATA.fahrzeug || "";
      document.getElementById("rolesLead").textContent = `${DAYS.length} Tage, ${nL} ${nL === 1 ? "Land" : "Länder"}${fz ? ", " + fz : ""}${kmTotal ? `, rund ${Math.round(kmTotal / 10) * 10 >= 1000 ? Math.round(kmTotal).toLocaleString("de-AT") : Math.round(kmTotal)} km` : ""}. Wähle, wie viel du sehen willst – mit Maus, Tastatur oder dem Smartphone. Jederzeit wechselbar.`; }
    // Teaser-Video (35 s) im Startfenster
    if (DATA.teaser) { const b = document.createElement("button"); b.className = "tzBtn"; b.textContent = "▶ Teaser ansehen (35 s)";
      b.onclick = () => { const src = innerHeight > innerWidth ? DATA.teaser.hoch || DATA.teaser.quer : DATA.teaser.quer || DATA.teaser.hoch;
        const box = document.createElement("div"); box.className = "tzBox"; box.innerHTML = `<div class="tzIn"><video src="${esc(src)}" controls autoplay playsinline></video><button class="big" data-x>Schließen</button></div>`;
        box.onclick = (e) => { if (e.target === box || e.target.hasAttribute("data-x")) box.remove(); }; document.body.appendChild(box); };
      b.className = "chip tzChip"; b.textContent = "▶ Teaser"; b.title = "Teaser ansehen (35 s)"; document.getElementById("hudTop").querySelector(".chips").prepend(b); }
    // Rollen ohne passende Inhalte ausblenden (z. B. keine Wien-Fäden)
    if (!DAYS.some((d) => (d.wien_faden || []).length)) delete ROLLEN.wien;

    const S = { rolle:null, idx:0, playing:false, tempo:5, breite:2, tiefe:1, thema:null, seen:new Set(), mythen:new Set(), wien:new Set(),
      kamera: KAMERA.some((k) => k[0] === merk.get("kamera")) ? merk.get("kamera") : "fahrt",
      musik: merk.get("musik", false) === true, vorlesen: VORLESEN.some((k) => k[0] === merk.get("vorlesen")) ? merk.get("vorlesen") : "aus" };
    const MUSIK = DATA.musik || {};
    const HAT_MUSIK = Object.values(MUSIK).some((l) => l && l.length);
    const HAT_VL = DAYS.some((d) => d.vorlesen && (d.vorlesen.chris || d.vorlesen.renate));
    const visible = (s) => { const a = s.art || "besuch";
      if (S.breite === 1) return a === "uebernachtung" || s.i === 0;
      if (S.breite === 2) return ["besuch","uebernachtung","faehre"].includes(a) || s.i === 0;
      return true; };
    const dayMatches = (d) => !S.thema || (d.themen || []).includes(S.thema) || (S.thema === "mythencheck" && (d.mythen || []).length) || (S.thema === "habsburg" && (d.wien_faden || []).length);
    const track = () => ST.filter(visible).filter((s) => dayMatches(dayOf(s.day)));

    // Zeitleiste
    const row = document.getElementById("railRow");
    row.style.setProperty("--days", DAYS.length);
    const flagge = (cc) => cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((x) => 0x1f1a5 + x.charCodeAt(0))) : "";
    let grp = null, grpCC = null;
    DAYS.forEach((d) => { const cc = ccOf(d);
      if (!grp || cc !== grpCC) { grpCC = cc; grp = document.createElement("div"); grp.className = "landGrp"; grp.style.setProperty("--lc", colOf(d));
        grp.innerHTML = `<span class="landName" title="${(COUNTRY[cc] || {}).n || cc}">${flagge(cc)} <em>${(COUNTRY[cc] || {}).n || cc}</em></span><div class="landTicks"></div>`; row.appendChild(grp); }
      const b = document.createElement("button"); b.className = "tick" + (d.status === "fehlt" ? " gap" : ""); b.style.background = colOf(d); b.textContent = d.tag; if (d.tag === 1 || d.tag % 5 === 0) b.classList.add("f5");
      b.title = "Tag " + d.tag + " · " + (d.titel || "noch ohne Eintrag"); b.setAttribute("aria-label", b.title); b.onclick = () => gotoDay(d.tag); grp.querySelector(".landTicks").appendChild(b); });
    const used = [...new Set(DAYS.flatMap((d) => d.land || []))].filter((c) => COUNTRY[c]);
    document.getElementById("legend").innerHTML = used.map((c) => `<span><i style="background:${COUNTRY[c].c}"></i>${COUNTRY[c].n}</span>`).join("") + '<span><i style="background:repeating-linear-gradient(135deg,#667 0 2px,transparent 2px 4px)"></i>ohne Eintrag</span>';

    // Rollen
    const rg = document.getElementById("roleGrid");
    Object.entries(ROLLEN).forEach(([k, r]) => { const b = document.createElement("button"); b.className = "role"; b.innerHTML = `<span class="k">${r.k}</span><span class="n">${r.n}</span><span class="d">${r.d}</span>`; b.onclick = () => setRole(k); rg.appendChild(b); });

    // Kurzer Hinweis beim Start (statt Rollen-Fenster)
    { const t = document.createElement("div"); t.className = "startHint"; t.innerHTML = (matchMedia("(pointer: coarse)").matches || innerWidth <= 900) ? "Tageskarte: Griff ziehen = mehr · links Stopp/Tag · rechts Tempo, tippen = Stopp" : "<kbd>Leertaste</kbd> fahren · <kbd>←</kbd><kbd>→</kbd> Station · <kbd>↓</kbd><kbd>↑</kbd> Tiefe · <kbd>−</kbd><kbd>+</kbd> Tempo · <kbd>/</kbd> suchen &amp; fragen";
      document.getElementById("screen").appendChild(t); setTimeout(() => t.classList.add("weg"), 7000); setTimeout(() => t.remove(), 8200); addEventListener("keydown", () => t.classList.add("weg"), { once: true }); }
    // Direkt zu einem Tag springen: /atlas/<reise>/?tag=7 (z. B. aus der Reise-Statistik)
    { const t0 = +new URLSearchParams(location.search).get("tag");
      if (t0 && dayOf(t0)) { Object.assign(S, { rolle: "entdecker", tempo: 3, breite: 3, tiefe: 2, thema: null }); S.idx = Math.max(0, track().findIndex((s) => s.day >= t0)); document.getElementById("roles").hidden = true; } }
    // Wetter je Tag (Open-Meteo Archiv, gleicher Zwischenspeicher wie die Reise-Statistik)
    const WETTER = DAYS.some((d) => d.wetter) ? Object.fromEntries(DAYS.filter((d) => d.wetter).map((d) => [d.tag, d.wetter])) : (() => { try { return JSON.parse(localStorage.getItem("atlas.stat.wetter.v1." + REISE)) || null; } catch (e) { return null; } })() || {};
    if (!Object.keys(WETTER).length) {
      const tw = DAYS.filter((d) => d.wetterOrt && d.datum);
      if (tw.length) {
        const q = new URLSearchParams({ latitude: tw.map((d) => d.wetterOrt.lat).join(","), longitude: tw.map((d) => d.wetterOrt.lon).join(","), start_date: tw[0].datum, end_date: tw[tw.length - 1].datum, timezone: "auto",
          daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,wind_speed_10m_max" });
        fetch("https://archive-api.open-meteo.com/v1/archive?" + q).then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => {
          const arr = Array.isArray(j) ? j : [j];
          tw.forEach((d, k) => { const dl = (arr[k] || {}).daily; if (!dl) return; const ix = dl.time.indexOf(d.datum); if (ix < 0) return;
            WETTER[d.tag] = { code: dl.weather_code[ix], max: dl.temperature_2m_max[ix], min: dl.temperature_2m_min[ix], regen: dl.precipitation_sum[ix], sonneH: dl.sunshine_duration[ix] != null ? dl.sunshine_duration[ix] / 3600 : null, wind: dl.wind_speed_10m_max[ix] }; });
          try { localStorage.setItem("atlas.stat.wetter.v1." + REISE, JSON.stringify(WETTER)); } catch (e) {}
          try { render(); } catch (e) {}
        }).catch(() => {});
      }
    }
    // babowalls.com: Mauern aus dem Galerie-Feed, die nach Datum oder Ortsname zu einem Tag passen (best effort)
    let MAUERN = [];
    fetch("https://cleebration-gallery-hub.vercel.app/feed/sites/babowalls.de.json").then((r) => (r.ok ? r.json() : null)).then((j) => {
      const items = Array.isArray(j) ? j : (j && (j.items || j.galleries || j.entries)) || [];
      const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const it of items) for (const d of DAYS) {
        const namen = (d.stationen || []).map((s) => norm(s.name).split(/[ ,(]/)[0]).filter((n) => n.length > 3);
        const t = norm(it.title) + " " + norm(it.name) + " " + (it.tags || []).map(norm).join(" ");
        if (it.date === d.datum || namen.some((n) => t.includes(n))) { MAUERN.push({ tag: d.tag, symbol: "🧱", titel: it.title, ort: it.name || "", jahr: String(it.date || it.year || "").slice(0, 4), url: `https://babowalls.com/mauer?mauer=${encodeURIComponent(it.slug)}`, gleicherTag: it.date === d.datum }); break; }
      }
      if (MAUERN.length) try { render(); } catch (e) {}
    }).catch(() => {});
    // Suche über diese Reise: Taste „/“ oder Knopf 🔎
    function suche() {
      const box = document.createElement("div"); box.className = "tzBox suche";
      box.innerHTML = `<div class="suIn"><input type="search" placeholder="Suchen oder fragen: „Wo war es am heißesten?“" aria-label="In dieser Reise suchen oder eine Frage stellen">
        <div class="frRow"><button class="big primary" data-frage>✨ Frag die Reise</button><span class="note">Antwort von Claude, nur aus unserem Tagebuch · max. 15 Fragen am Tag</span></div>
        <div class="antwort" hidden></div><ol></ol><button class="big" data-x>Schließen</button></div>`;
      const inp = box.querySelector("input"), ol = box.querySelector("ol"), an = box.querySelector(".antwort");
      const fragen = async () => { const f = inp.value.trim(); if (f.length < 3) return; an.hidden = false; ol.innerHTML = ""; an.innerHTML = "<p class='note'>Claude liest im Tagebuch nach …</p>";
        try { const r = await fetch("/api/frage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ frage: f, reise: REISE }) }); const j = await r.json();
          if (j.fehler) { an.innerHTML = `<p class="note">${esc(j.fehler)}</p>`; return; }
          an.innerHTML = `<p>${esc(j.antwort)}</p>${(j.quellen || []).map((q) => q.reise === REISE ? `<button data-t="${q.tag}">→ Tag ${q.tag} · ${esc(q.titel)}</button>` : `<a href="/atlas/${esc(q.reise)}/?tag=${q.tag}">→ ${esc(q.titelReise)} · Tag ${q.tag}</a>`).join("")}`;
        } catch (e) { an.innerHTML = "<p class='note'>Die Frage konnte gerade nicht beantwortet werden.</p>"; } };
      box.querySelector("[data-frage]").onclick = fragen;
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") fragen(); });
      an.onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { box.remove(); gotoDay(+b.dataset.t); } };
      const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      inp.oninput = () => { const q = norm(inp.value).trim(); if (q.length < 2) { ol.innerHTML = ""; return; }
        const treffer = DAYS.map((d) => ({ d, txt: [d.titel, d.satz, d.teaser, ...(d.stationen || []).map((s) => s.name + " " + (s.notiz || "")), ...(d.fotos || []).map((f) => f.text), ...(d.passend || []).map((x) => x.titel + " " + x.ort)].filter(Boolean).join(" · ") }))
          .filter((x) => norm(x.txt).includes(q)).slice(0, 12);
        ol.innerHTML = treffer.length ? treffer.map((x) => { const i = norm(x.txt).indexOf(q); const aus = x.txt.slice(Math.max(0, i - 40), i + 80);
          return `<li><button data-t="${x.d.tag}"><b>Tag ${x.d.tag} · ${esc(x.d.titel || "")}</b><span>…${esc(aus)}…</span></button></li>`; }).join("") : "<li class='leer'>Nichts gefunden.</li>"; };
      ol.onclick = (e) => { const b = e.target.closest("[data-t]"); if (b) { box.remove(); gotoDay(+b.dataset.t); } };
      box.onclick = (e) => { if (e.target === box || e.target.hasAttribute("data-x")) box.remove(); };
      document.body.appendChild(box); inp.focus();
    }
    document.getElementById("sucheBtn").onclick = suche;
    addEventListener("keydown", (e) => { if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); suche(); } });
    const wmoIcon = (c) => c == null ? "" : c === 0 ? "☀️" : c <= 2 ? "🌤️" : c === 3 ? "☁️" : c <= 48 ? "🌫️" : c <= 57 ? "🌦️" : c <= 67 ? "🌧️" : c <= 77 ? "🌨️" : c <= 82 ? "🌦️" : c <= 86 ? "🌨️" : "⛈️";

    // Lightbox
    const lb = document.getElementById("lightbox");
    // alle Fotos der Reise in Reihenfolge – Blättern läuft über Tagesgrenzen weiter
    const ALLF = []; DAYS.forEach((d) => (d.fotos || []).forEach((f, i) => ALLF.push({ day: d.tag, i, n: d.fotos.length, f })));
    // jedes Foto gehört zur nächstgelegenen Station seines Tages (GPS, sonst Name im Fototext, sonst erste Station)
    ALLF.forEach((x) => { const sts = ST.filter((s) => s.day === x.day); if (!sts.length) { x.st = null; return; }
      if (typeof x.f.lat === "number") { let b = sts[0], bd = Infinity; sts.forEach((s) => { const v = d2([s.lon, s.lat], [x.f.lon, x.f.lat]); if (v < bd) { bd = v; b = s; } }); x.st = b; }
      else x.st = sts.find((s) => x.f.text && s.name.toLowerCase().includes(String(x.f.text).toLowerCase().split(/[ ,]/)[0])) || sts[0]; });
    let lbIdx = -1, lbStartDay = null, lbGruppe = [];
    const preload = (k) => { const x = ALLF[k]; if (x) { const im = new Image(); im.src = x.f.url; } };
    function showLb(k) {
      if (!ALLF.length || k < 0 || k >= ALLF.length) return; const x = ALLF[k];
      if (lbIdx < 0 || !lbGruppe.includes(k)) lbGruppe = ALLF.map((y, j) => (y.day === x.day && y.st === x.st ? j : -1)).filter((j) => j >= 0);
      lbIdx = k; const pos = lbGruppe.indexOf(k);
      document.getElementById("lbPrev").hidden = pos <= 0; document.getElementById("lbNext").hidden = pos >= lbGruppe.length - 1;
      const img = document.getElementById("lbImg"); img.src = x.f.url; img.alt = x.f.text || "";
      document.getElementById("lbCap").innerHTML = `<span>Tag ${x.day} · ${x.st ? esc(x.st.name) + " · " : ""}${pos + 1}/${lbGruppe.length}${x.f.zeit ? " · " + esc(x.f.zeit) : ""}${pos === lbGruppe.length - 1 ? " · Ende dieser Station" : ""}</span>${esc(x.f.text)}`;
      lb.hidden = false; preload(k + 1); preload(k - 1); broadcast();
    }
    const openPhoto = (f) => { lbStartDay = (go.last || {}).day; const k = ALLF.findIndex((x) => x.f.url === f.url); showLb(k < 0 ? 0 : k); };
    const lbStep = (n) => { const pos = lbGruppe.indexOf(lbIdx) + n; if (pos < 0 || pos >= lbGruppe.length) return; showLb(lbGruppe[pos]); };
    function closeLb() { if (lb.hidden) return; lb.hidden = true; const x = ALLF[lbIdx]; lbIdx = -1; lbGruppe = [];
      if (x && x.day !== lbStartDay) gotoDay(x.day); else broadcast(); }
    document.getElementById("lbClose").onclick = closeLb;
    document.getElementById("lbPrev").onclick = (e) => { e.stopPropagation(); lbStep(-1); };
    document.getElementById("lbNext").onclick = (e) => { e.stopPropagation(); lbStep(1); };
    let swX = null;
    let swY = 0;
    lb.addEventListener("pointerdown", (e) => { swX = e.clientX; swY = e.clientY; });
    lb.addEventListener("pointerup", (e) => { if (swX == null) return; const dx = e.clientX - swX, dy = e.clientY - swY; swX = null;
      if (dy > 80 && dy > Math.abs(dx) * 1.3) { closeLb(); return; } if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); });
    lb.addEventListener("touchstart", (e) => { swY = e.touches[0].clientY; swX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => { if (swX == null) return; const t = e.changedTouches[0], dx = t.clientX - swX, dy = t.clientY - swY; swX = null;
      if (dy > 80 && dy > Math.abs(dx) * 1.3) closeLb(); else if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); }, { passive: true });
    // Video-/Teaser-Fenster: nach unten wischen schließt
    { let vy = null, vx = 0; document.addEventListener("touchstart", (e) => { if (e.target.closest(".tzBox")) { vy = e.touches[0].clientY; vx = e.touches[0].clientX; } }, { passive: true });
      document.addEventListener("touchend", (e) => { if (vy == null) return; const t = e.changedTouches[0], dy = t.clientY - vy, dx = t.clientX - vx; vy = null; const box = e.target.closest(".tzBox");
        if (box && dy > 80 && dy > Math.abs(dx) * 1.3) box.remove(); }, { passive: true }); }
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });

    // ---------- Ton: Musik je Land + Vorlesen (Chris/Renate) ----------
    const ton = (() => {
      const musik = new Audio(); musik.preload = "none"; let musikUrl = "";
      const stimme = new Audio(); stimme.preload = "auto";
      let land = null, nr = 0, sprecherJetzt = null, nachher = null, naechster = "chris", gesperrt = false;
      const liest = () => !!sprecherJetzt && !stimme.paused && !stimme.ended;
      // iOS lässt die Lautstärke nicht setzen – dort pausiert die Musik beim Vorlesen statt leiser zu werden
      const lautRegelbar = (() => { try { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; } catch (e) { return false; } })();
      let fadeT = null;
      function blende() {
        const ziel = !S.musik ? 0 : liest() ? (lautRegelbar ? 0.07 : 0) : 0.32;
        clearInterval(fadeT);
        if (!lautRegelbar) { if (ziel === 0) musik.pause(); else spiele(musik); return; }
        if (ziel > 0 && musik.paused && musikUrl) { musik.volume = 0; spiele(musik); }
        fadeT = setInterval(() => { const v = musik.volume, d = ziel - v;
          if (Math.abs(d) < 0.006) { musik.volume = ziel; clearInterval(fadeT); if (ziel === 0) musik.pause(); return; }
          musik.volume = d < 0 ? Math.max(ziel, Math.max(0, v * 0.92 - 0.0008)) : Math.min(1, v + 0.012); }, 40);
      }
      function spiele(a) { const p = a.play(); if (p && p.catch) p.then(() => { if (gesperrt) { gesperrt = false; hinweis(); } }).catch((e) => { if (e && e.name === "NotAllowedError") { gesperrt = true; hinweis(); } }); }
      function hinweis() { const c = document.getElementById("tonChip"); if (c) c.hidden = !gesperrt; }
      document.getElementById("tonChip").onclick = () => { gesperrt = false; hinweis(); if (sprecherJetzt) spiele(stimme); blende(); };
      function stueck() { const l = MUSIK[land] || []; return l.length ? l[nr % l.length] : null; }
      function laden() { const x = stueck(); if (!x) return false; if (musikUrl !== x.url) { musikUrl = x.url; musik.src = x.url; } info(); return true; }
      musik.addEventListener("ended", () => { nr++; laden(); if (S.musik) { musik.volume = lautRegelbar ? 0 : 1; spiele(musik); blende(); } });
      // Länder ohne eigene freie Musik spielen die eines Nachbarlands (z. B. Kroatien → Slowenien/Bela krajina)
      const NACHBAR = { HR: ["SI", "ME", "IT", "AT"], BA: ["RS", "ME", "HR"], XK: ["AL", "RS", "MK"], BG: ["MK", "GR", "RS"], SI: ["AT", "HR", "IT"], ME: ["RS", "AL"], AL: ["GR", "MK"], MK: ["GR", "RS"], RS: ["MK", "ME"], GR: ["MK", "AL"], CH: ["AT", "IT"], DE: ["AT"], HU: ["AT", "RS"] };
      const mitMusik = (k) => (MUSIK[k] && MUSIK[k].length ? k : (NACHBAR[k] || []).find((x) => MUSIK[x] && MUSIK[x].length) || null);
      function landWechsel(roh) {
        const neu = mitMusik(roh);
        if (!neu || neu === land) return; // gar keine Musik in der Nähe: weiter das Bisherige
        land = neu; nr = 0;
        if (!S.musik || musik.paused) { laden(); return; }
        if (!lautRegelbar) { laden(); spiele(musik); return; }
        clearInterval(fadeT); const t = setInterval(() => { musik.volume = Math.max(0, musik.volume * 0.92 - 0.0008);
          if (musik.volume <= 0.006) { clearInterval(t); laden(); musik.volume = 0; spiele(musik); blende(); } }, 40);
      }
      function info() {
        const x = stueck(), el = document.getElementById("musikInfo"); if (!el) return;
        el.innerHTML = x && S.musik ? `♪ ${esc(x.titel)}${x.urheber ? " – " + esc(x.urheber) : ""} · <a href="${esc(x.seite)}" target="_blank" rel="noopener">${esc(x.lizenz || "Lizenz")}</a>` : (HAT_MUSIK ? "Freie Musik aus den Reiseländern (Wikimedia Commons)." : "");
      }
      function vlInfo() { const el = document.getElementById("vlInfo"); if (el) el.textContent = sprecherJetzt && liest() ? `🔊 ${SPRECHER[sprecherJetzt]} liest Tag ${(go.last || {}).day || ""}` : (S.vorlesen === "aus" ? "" : "liest bei jedem neuen Tag"); }
      function fertig() { sprecherJetzt = null; vlInfo(); blende(); broadcast(); const f = nachher; nachher = null; if (f) setTimeout(f, 600); }
      stimme.addEventListener("ended", fertig); stimme.addEventListener("error", fertig);
      function stopp() { if (!stimme.paused) stimme.pause(); if (sprecherJetzt) fertig(); }
      function lies(d) {
        stopp(); if (S.vorlesen === "aus" || !d || !d.vorlesen) return;
        const da = ["chris", "renate"].filter((k) => d.vorlesen[k]); if (!da.length) return;
        let k = S.vorlesen === "zufall" ? da[Math.floor(Math.random() * da.length)] : S.vorlesen === "abwechselnd" ? naechster : S.vorlesen;
        if (!da.includes(k)) k = da[0];
        if (S.vorlesen === "abwechselnd") naechster = k === "chris" ? "renate" : "chris";
        sprecherJetzt = k; stimme.src = d.vorlesen[k]; spiele(stimme); blende(); vlInfo(); broadcast();
      }
      let gelesen = null;
      return {
        liest, sprecher: () => (liest() ? sprecherJetzt : null),
        danach(f) { nachher = f; },
        ankunft(d) { landWechsel(ccOf(d)); if (d.tag !== gelesen) { gelesen = d.tag; lies(d); } },
        setMusik(an) { S.musik = !!an && HAT_MUSIK; merk.set("musik", S.musik); if (S.musik) { if (!land) landWechsel(ccOf(dayOf((go.last || ST[0] || {}).day) || DAYS[0])); if (!land) { land = Object.keys(MUSIK)[0]; } laden(); } info(); blende(); render(); },
        setVorlesen(k) { if (!VORLESEN.some((x) => x[0] === k)) return; S.vorlesen = k; merk.set("vorlesen", k);
          if (k === "aus") stopp(); else { const d = dayOf((go.last || {}).day); gelesen = d ? d.tag : null; if (d) lies(d); }
          vlInfo(); render(); },
        start() { document.getElementById("musikBox").hidden = !HAT_MUSIK; document.getElementById("vlBox").hidden = !HAT_VL; if (!HAT_MUSIK) S.musik = false; info(); vlInfo(); },
      };
    })();
    ton.start();
    document.getElementById("tonBtn").onclick = (e) => { const o = document.getElementById("side").classList.toggle("offen"); e.currentTarget.setAttribute("aria-expanded", o); };
    function setKamera(k) { if (!KAMERA.some((x) => x[0] === k)) return; S.kamera = k; merk.set("kamera", k);
      if (map && van && !anim) { const s = go.last; if (k === "nord") map.easeTo({ bearing: 0, duration: 700 }); else if (k === "fahrt") map.easeTo({ bearing: kameraZiel(s), pitch: narrow ? 50 : 70, duration: 900 }); }
      render(); }
    document.querySelectorAll("#tonPanel .seg").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return;
      if (g.dataset.ks === "tempo") { S.tempo = +b.dataset.v; render(); broadcast(); } else if (g.dataset.ks === "breite") setBreite(+b.dataset.v); else if (g.dataset.ks === "tiefe") setTiefeOhne(+b.dataset.v); else if (g.dataset.ks === "kamera") setKamera(b.dataset.v); else if (g.dataset.ks === "musik") ton.setMusik(b.dataset.v === "an"); else if (g.dataset.ks === "vorlesen") ton.setVorlesen(b.dataset.v); }));

    setTimeout(() => { if (!van) render(); }, 0);
    // ---------- Karte ----------
    const map = new maplibregl.Map({
      container: "map", style: "https://tiles.openfreemap.org/styles/liberty",
      bounds: (() => { const la = ST.map((x) => x.lat), lo = ST.map((x) => x.lon); return [[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]]; })(), fitBoundsOptions: { padding: narrow ? 30 : 120 }, pitch: narrow ? 35 : 55, bearing: -10, maxPitch: 80, attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Höhen: <a href="https://registry.opendata.aws/terrain-tiles" target="_blank" rel="noopener">Terrain Tiles (AWS Open Data)</a> · Routen: <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a> (Näherung)' }), "bottom-left");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    map.on("rotatestart", (e) => { if (e && e.originalEvent && S.kamera !== "frei") setKamera("frei"); });
    const pinEls = [];
    let van, reiser, fotoMarkers = [];
    // Fortbewegung je Etappe: stations[].mit = "rad" | "fuss" | "boot" | "bahn"; ohne Angabe Auto, kurze Wege (< 1,5 km) ohne Fahrzeugbewegung
    // gleiche Liste wie Redaktion → Werkzeug „Etappen“ (src/etappen.js im Repo redaktion); v = Tempo relativ zum Auto, strasse = folgt der Route
    const MIT = { auto: { n: "Auto", i: "" }, rad: { n: "Fahrrad", i: "🚲", v: 0.35, strasse: true }, fuss: { n: "zu Fuß", i: "🚶", v: 0.12 }, zug: { n: "Zug", i: "🚆", v: 0.8 }, taxi: { n: "Taxi", i: "🚕", v: 0.9, strasse: true },
      taxiboot: { n: "Taxiboot", i: "🚤", v: 0.6 }, boot: { n: "Boot", i: "⛵", v: 0.45 }, schiff: { n: "Schiff", i: "🚢", v: 0.5 }, faehre: { n: "Fähre", i: "⛴️", v: 0.5 }, seilbahn: { n: "Seilbahn", i: "🚡", v: 0.25 }, bahn: { n: "Seilbahn", i: "🚡", v: 0.25 }, kurz: { n: "kurzer Weg", i: "" } };
    const km2 = (a, b) => Math.sqrt(d2([a.lon, a.lat], [b.lon, b.lat])) * 111.2;
    const mitVon = (prev, s) => s.mit && MIT[s.mit] ? s.mit : (prev && km2(prev, s) < 1.5 ? "kurz" : "auto");
    let park = null; // Station, an der das Auto gerade steht
    function parkFuer(s) { const k = ST.indexOf(s); for (let j = k; j >= 0; j--) { const a = ST[j], b = ST[j - 1]; if (!b || mitVon(b, a) === "auto") return a; } return ST[0]; }
    function fzInfo(mit) { const tr = track(), s = tr[S.idx]; if (!s) return; const d = dayOf(s.day), m = MIT[mit] || MIT.auto;
      const kmVor = DAYS.filter((x) => x.tag < d.tag).reduce((a, x) => a + ((x.route && x.route.km) || 0), 0);
      const p = park || s, pd = dayOf(p.day), heute = p.day === d.tag && d.line && d.route ? Math.round((p.ri || 0) / (d.line.length - 1) * d.route.km) : 0;
      let h = `<b>${mit === "auto" || !mit ? esc(FAHRZEUGE[fzJetzt] ? FAHRZEUGE[fzJetzt].n : "Auto") : m.i + " " + m.n}</b>`;
      if (mit === "auto" || !mit) h += `<span>${S.playing && anim ? "unterwegs" : "steht"} · ${esc(p.name)}</span><span>heute ${heute} von ${Math.round((d.route && d.route.km) || 0)} km</span><span>Reise bisher ≈ ${Math.round(kmVor + heute).toLocaleString("de-AT")} km</span>`;
      else { const v = tr[S.idx - 1]; h += `<span>Etappe ${v ? esc(v.name) + " → " : ""}${esc(s.name)}</span>${v ? `<span>≈ ${km2(v, s).toFixed(1).replace(".", ",")} km Luftlinie</span>` : ""}<span>Auto steht bei ${esc((park || p).name)}</span>`; }
      new maplibregl.Popup({ closeButton: true, className: "fzPop", offset: 18 }).setLngLat(mit === "auto" || !mit ? van.getLngLat() : reiser.getLngLat()).setHTML(h).addTo(map); }
    map.on("load", () => {
      map.addSource("dem", { type: "raster-dem", tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"], encoding: "terrarium", tileSize: 256, maxzoom: 12 });
      map.setTerrain({ source: "dem", exaggeration: 1.6 });
      try { map.setSky({ "sky-color": "#0f2c38", "horizon-color": "#3c6c78", "fog-color": "#0f2c38", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.4 }); } catch (e) {}
      map.addLayer({ id: "hills", type: "hillshade", source: "dem", paint: { "hillshade-exaggeration": 0.45, "hillshade-shadow-color": "#2a3a3a" } }, firstSymbol());
      map.addSource("all", { type: "geojson", data: fc(DAYS.filter((d) => d.line).map((d) => line(d.line, { tag: d.tag, col: colOf(d) }))) });
      map.addSource("done", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "all", type: "line", source: "all", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.45, "line-dasharray": [1, 1.6] } });
      map.addLayer({ id: "done-casing", type: "line", source: "done", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0a1b23", "line-width": 7 } });
      map.addLayer({ id: "done", type: "line", source: "done", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "col"], "line-width": 4.5 } });
      map.addSource("spur", { type: "geojson", data: fc([]) });
      map.addSource("vorschau", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "vorschau", type: "line", source: "vorschau", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff6d8", "line-width": 5, "line-opacity": 0.9, "line-dasharray": [1.2, 1.4] } });
      map.addLayer({ id: "spur-casing", type: "line", source: "spur", filter: ["==", ["get", "mit"], "auto"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0a1b23", "line-width": 7 } });
      map.addLayer({ id: "spur", type: "line", source: "spur", filter: ["==", ["get", "mit"], "auto"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "col"], "line-width": 4.5 } });
      map.addLayer({ id: "spur-neben", type: "line", source: "spur", filter: ["!=", ["get", "mit"], "auto"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff6d8", "line-width": 3.5, "line-dasharray": [0.6, 1.6] } });

      ST.forEach((s, k) => { const e = document.createElement("div"); e.className = "pin" + (s.art === "uebernachtung" ? " night" : ""); e.title = "Tag " + s.day + " · " + s.name;
        e.onclick = () => { let t = track(); let i = t.indexOf(s); if (i < 0) { S.breite = 3; S.thema = null; t = track(); i = t.indexOf(s); } S.idx = Math.max(0, i); go(true); };
        pinEls[k] = e; new maplibregl.Marker({ element: e }).setLngLat([s.lon, s.lat]).addTo(map); });
      const ve = document.createElement("div"); ve.className = "van";
      van = new maplibregl.Marker({ element: ve, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([ST[0].lon, ST[0].lat]).addTo(map);
      setzeFahrzeug(dayOf(ST[0].day));
      { // Kompass wie in Google Maps: zeigt nach Norden, erscheint wenn gedreht/geneigt; Tippen = Norden oben, flach
        const k = document.getElementById("kompass"), nadel = k.querySelector(".kn");
        const upd = () => { const b = map.getBearing(), pt = map.getPitch(); nadel.style.transform = `rotate(${-b}deg)`; k.classList.toggle("still", Math.abs(b) < 0.5 && pt < 1); };
        map.on("rotate", upd); map.on("pitch", upd); upd();
        k.onclick = () => { if (S.kamera !== "nord") setKamera("nord"); map.easeTo({ bearing: 0, pitch: 0, duration: reduced ? 0 : 600 }); }; }
      const re = document.createElement("div"); re.className = "reiser"; re.hidden = true;
      reiser = new maplibregl.Marker({ element: re, offset: [18, -16] }).setLngLat([ST[0].lon, ST[0].lat]).addTo(map);
      ve.addEventListener("click", (e) => { e.stopPropagation(); fzInfo("auto"); }); re.addEventListener("click", (e) => { e.stopPropagation(); fzInfo(re.dataset.mit); });
      drawDone(); if (track()[S.idx]) go(true); else render();
    });
    function firstSymbol() { const l = (map.getStyle().layers || []).find((x) => x.type === "symbol"); return l && l.id; }
    function fc(f) { return { type: "FeatureCollection", features: f }; }
    function line(c, p) { return { type: "Feature", properties: p || {}, geometry: { type: "LineString", coordinates: c } }; }

    function curPos() { const s = track()[S.idx]; return s ? { day: s.day, ri: s.ri ?? 0 } : { day: 1, ri: 0 }; }
    function drawDone(partial) {
      if (!map.getSource("done")) return;
      const p = partial || curPos();
      const feats = [];
      DAYS.forEach((d) => { if (!d.line) return; if (d.tag < p.day) feats.push(line(d.line, { col: colOf(d) }));
        else if (d.tag === p.day && p.ri > 0) feats.push(line(d.line.slice(0, p.ri + 1), { col: colOf(d) })); });
      map.getSource("done").setData(fc(feats)); if (map.getSource("spur")) map.getSource("spur").setData(fc([]));
      const vis = new Set(track()); ST.forEach((s, k) => pinEls[k] && pinEls[k].classList.toggle("dim", !vis.has(s)));
    }

    // ---------- Bewegung ----------
    let anim = null, timer = null, vorTimer = null, wartet = null, animAuto = false;
    // Zwei-Finger-Gesten: zoomen/drehen auch während der Fahrt. Gezoomter Maßstab bleibt; Drehen schaltet die Kamera auf „frei“.
    let hand = false, handZoom = null;
    // Fahrzeug aus der Mitte rücken, solange die Tageskarte bzw. Steuerung Platz belegt (Kartenrand-Polster)
    let polsterAlt = "";
    function polster() { const c = document.getElementById("card"), sd = document.getElementById("side"), W = innerWidth, H = innerHeight, p = { top: 0, bottom: 0, left: 0, right: 0 };
      if (c && !c.classList.contains("zu") && c.offsetParent) { const r = c.getBoundingClientRect();
        if (r.left > W * 0.3) p.right = Math.round(Math.min(W * 0.55, W - r.left)); else p.bottom = Math.round(Math.min(H * 0.6, H - r.top)); }
      if (sd && !sd.classList.contains("zu") && document.body.classList.contains("touch")) { const r = sd.getBoundingClientRect(); p.left = Math.round(Math.min(W * 0.45, r.right)); }
      const k = JSON.stringify(p); if (k === polsterAlt) return; polsterAlt = k; if (anim || map.isMoving()) map.setPadding(p); else map.easeTo({ padding: p, duration: 500 }); }
    addEventListener("resize", () => setTimeout(polster, 100));
    if (window.ResizeObserver) new ResizeObserver(() => requestAnimationFrame(polster)).observe(document.getElementById("card"));
    new MutationObserver(() => requestAnimationFrame(polster)).observe(document.getElementById("card"), { attributes: true, attributeFilter: ["class", "data-tiefe"] });
    new MutationObserver(() => requestAnimationFrame(polster)).observe(document.getElementById("side"), { attributes: true, attributeFilter: ["class"] });
    map.once("load", () => setTimeout(polster, 300));
    // Quellenangabe nur als „i“ (aufgeklappt deckt sie am Handy die Karte zu)
    { const zu = () => { const a = document.querySelector(".maplibregl-ctrl-attrib"); if (a) { a.classList.remove("maplibregl-compact-show"); a.removeAttribute("open"); } };
      map.once("load", () => { zu(); setTimeout(zu, 400); setTimeout(zu, 2000); }); map.once("idle", zu); }
    map.on("touchstart", (e) => { if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length >= 2) hand = true; });
    map.on("touchend", (e) => { if (!hand || (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length)) return; hand = false; handZoom = map.getZoom(); });
    map.on("wheel", () => { clearTimeout(map._hz); map._hz = setTimeout(() => (handZoom = map.getZoom()), 300); });
    map.on("rotateend", (e) => { if (e.originalEvent && S.kamera !== "frei") { S.kamera = "frei"; merk.set("kamera", "frei"); render(); broadcast(); } });
    function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
    // Richtung (Grad, im Uhrzeigersinn von Norden) von a nach b
    const brg = (a, b) => Math.atan2((b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180), b[1] - a[1]) * 180 / Math.PI;
    const mischWinkel = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
    function richtungAn(d, ri) { if (!d || !d.line || ri == null) return null; const L = d.line;
      const a = L[Math.max(0, ri - 6)], b = L[Math.min(L.length - 1, ri + 6)]; return a && b && (a[0] !== b[0] || a[1] !== b[1]) ? brg(a, b) : null; }
    function kameraZiel(s) { // Blickrichtung an einer Station je Kamera-Modus
      if (S.kamera === "nord") return 0;
      if (S.kamera === "fahrt") { const r = s ? richtungAn(dayOf(s.day), s.ri) : null; return r == null ? map.getBearing() : r; }
      return map.getBearing(); }
    // Fahrzeug je Tag (Reise-Standard oder Tageswert) und Ausrichtung
    let fzJetzt = null;
    function setzeFahrzeug(d) { const k = (d && FAHRZEUGE[d.fahrzeug] ? d.fahrzeug : null) || (FAHRZEUGE[DATA.fahrzeugTyp] ? DATA.fahrzeugTyp : "l3");
      if (k === fzJetzt || !van) return; fzJetzt = k; const el = van.getElement(); el.innerHTML = fahrzeugSvg(k); el.title = FAHRZEUGE[k].n; }
    // Geschwindigkeit in km pro Sekunde je Stufe (Stufe 5 ≈ 30 km/s); Dauer folgt der Streckenlänge
    const kmProSek = (t) => (t <= 5 ? 1.5 * Math.pow(25 / 1.5, (t - 1) / 4) : 25 * Math.pow(1.45, t - 5)); // Stufe 1 ≈ 1,5 km/s · 5 ≈ 25 · 10 ≈ 160
    const fahrDauer = (path) => { let km = 0; for (let k = 1; k < path.length; k++) km += Math.sqrt(d2(path[k], path[k - 1])) * 111.2;
      return Math.max(500, Math.min(240000, km / kmProSek(S.tempo) * 1000)); };
    let rollt = false; // fährt gerade durch (kein Anfahren/Abbremsen an Zwischenstationen)
    // Fortschritt des Tages (Balken + km) – aus dem Punkt-Index auf der Tageslinie
    // Uhr nach Fotos: Aufnahmezeiten auf die Tagesroute legen und zwischen zwei Fotos linear schätzen
    const uhrCache = {};
    function uhrAnker(d) { if (uhrCache[d.tag]) return uhrCache[d.tag]; const L = d.line || [], roh = [];
      (d.fotos || []).forEach((f) => { if (!f.zeit || typeof f.lat !== "number" || !L.length) return; const [h, m] = f.zeit.split(":").map(Number); if (isNaN(h)) return;
        let bi = 0, bd = Infinity; for (let i = 0; i < L.length; i++) { const v = d2(L[i], [f.lon, f.lat]); if (v < bd) { bd = v; bi = i; } }
        if (bd < 0.0004) roh.push({ i: bi, min: h * 60 + (m || 0) }); }); // nur Fotos nahe der Route (~2 km)
      /* nach Zeit; nur Fotos, die auf der Route vorwärts liegen (Rundfahrten: Abendfoto am Start fällt weg) */ roh.sort((a, b) => a.min - b.min || a.i - b.i); const out = [];
      roh.forEach((a) => { if (!out.length || (a.min >= out[out.length - 1].min && a.i >= out[out.length - 1].i)) out.push(a); });
      return (uhrCache[d.tag] = out); }
    function uhrSetzen(day, ri) { const el = document.getElementById("uhr"); if (!el || el.hidden) return; const d = dayOf(day); const A = d ? uhrAnker(d) : [];
      const b = el.querySelector("b"), sm = el.querySelector("small");
      if (!A.length) { b.textContent = "–:–"; sm.textContent = "keine Fotozeit"; el.classList.add("leer"); return; } el.classList.remove("leer");
      let min, art; if (ri <= A[0].i) { min = A[0].min; art = ri < A[0].i ? "vor dem 1. Foto" : "Foto"; } else if (ri >= A[A.length - 1].i) { min = A[A.length - 1].min; art = ri > A[A.length - 1].i ? "nach dem letzten Foto" : "Foto"; }
      else { let k = 1; while (A[k].i < ri) k++; const a = A[k - 1], c = A[k]; min = a.min + (c.min - a.min) * ((ri - a.i) / ((c.i - a.i) || 1)); art = "geschätzt"; }
      const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60); b.textContent = `${art === "geschätzt" ? "≈ " : ""}${h}:${String(m).padStart(2, "0")}`; sm.textContent = art;
      el.querySelector(".h").setAttribute("transform", `rotate(${(h % 12) * 30 + m / 2} 20 20)`); el.querySelector(".m").setAttribute("transform", `rotate(${m * 6} 20 20)`); }
    { const ub = document.getElementById("uhrBtn"), u = document.getElementById("uhr");
      const setUhr = (an) => { u.hidden = !an; ub.setAttribute("aria-pressed", an); ub.classList.toggle("on", an); merk.set("uhr", an); if (an) { const s = track()[S.idx]; if (s) uhrSetzen(s.day, s.ri || 0); } };
      ub.onclick = () => setUhr(u.hidden); setTimeout(() => setUhr(merk.get("uhr", false) === true), 0); }
    // Vollbild: iPad/Mac/Android über die Fullscreen-API; iPhone kann das im Browser nicht → als App auf den Home-Bildschirm
    { const vb = document.getElementById("vollBtn"), de = document.documentElement;
      const standalone = matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches || navigator.standalone;
      const kann = (document.fullscreenEnabled || document.webkitFullscreenEnabled) && (de.requestFullscreen || de.webkitRequestFullscreen); const ist = () => document.fullscreenElement || document.webkitFullscreenElement;
      if (standalone) vb.hidden = true;
      vb.onclick = () => {
        if (kann) { if (ist()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else (de.requestFullscreen || de.webkitRequestFullscreen).call(de); return; }
        const box = document.createElement("div"); box.className = "tzBox"; box.innerHTML = `<div class="tzIn vollHilfe"><h3>Vollbild am iPhone</h3><p>Safari erlaubt am iPhone kein Vollbild für Webseiten. So geht es trotzdem:</p><ol><li>Unten auf <b>Teilen</b> <span aria-hidden="true">⬆︎</span> tippen</li><li><b>„Zum Home-Bildschirm“</b> wählen</li><li>Den Reise-Atlas dann über das neue Symbol öffnen – ohne Browserleisten.</li></ol><button class="btn primary" data-x>OK</button></div>`;
        box.addEventListener("click", (e) => { if (e.target === box || e.target.hasAttribute("data-x")) box.remove(); }); document.body.appendChild(box); };
      const upd = () => { vb.textContent = ist() ? "⛶ Vollbild beenden" : "⛶ Vollbild"; }; document.addEventListener("fullscreenchange", upd); document.addEventListener("webkitfullscreenchange", upd); }
    function tagFort(day, ri) { uhrSetzen(day, ri); const el = document.querySelector("#card .tagFort"); const d = dayOf(day); if (!el || !d || !d.line) return;
      const f = Math.max(0, Math.min(1, ri / (d.line.length - 1))); el.querySelector("i").style.width = (f * 100).toFixed(1) + "%";
      el.querySelector("span").textContent = `${Math.round(f * d.route.km)} / ${Math.round(d.route.km)} km`; }
    function animateAlong(path, ms, done, ziel, farbe, fort, fz, mit) { fz = fz || van; const dreht = fz === van;
      stopAnim();
      if (reduced || path.length < 2 || ms < 50) { done(); return; }
      const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.sqrt(d2(path[k], path[k - 1])));
      const L = cum[cum.length - 1] || 1; let tLetzt = performance.now(), fort0 = 0; const t0Tempo = S.tempo; animAuto = !!go.autoLauf;
      // weich anfahren nur aus dem Stand, weich bremsen nur vor dem Ende bzw. einem längeren Halt; dazwischen gleichmäßig
      const anfahren = !rollt, bremsen = !S.playing || S.idx >= track().length - 1 || halt(track()[S.idx]) > 400; rollt = true;
      const kurve = (f) => { const a = anfahren ? 0.18 : 0, b = bremsen ? 0.18 : 0, v = 1 / (1 - a / 2 - b / 2);
        if (f < a) return v * f * f / (2 * a); if (f > 1 - b) { const r = 1 - f; return 1 - v * r * r / (2 * b); } return v * (f - a / 2); };
      const punktBei = (t) => { let k = 1; while (k < cum.length - 1 && cum[k] < t) k++; const a = path[k - 1], b = path[k], sg = (cum[k] - cum[k - 1]) || 1, u = Math.max(0, Math.min(1, (t - cum[k - 1]) / sg)); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
      const z0 = map.getZoom(), p0 = map.getPitch(); let kopf = map.getBearing(); let fzKopf = dreht ? van.getRotation() : 0;
      const fahrt = S.kamera === "fahrt", zt = fahrt ? 11.6 : ziel.zoom, pt = fahrt ? 72 : ziel.pitch;
      const vor = Math.max(0.004, Math.min(0.03, L * 0.12)); // Blick voraus (~0,4–3 km)
      const step = (now) => {
        const dt = Math.min(100, now - tLetzt); tLetzt = now; if (!(animAuto && !S.playing)) fort0 += dt / ms * (kmProSek(S.tempo) / kmProSek(t0Tempo)); const f = Math.min(1, fort0); const e = kurve(f); const target = e * L;
        const pos = punktBei(target); const g = Math.min(1, f / 0.2);
        const cam = { center: pos, zoom: z0 + (zt - z0) * g, pitch: p0 + (pt - p0) * g };
        const voraus = brg(pos, punktBei(Math.min(L, target + vor)));
        fzKopf = mischWinkel(fzKopf, voraus, 0.25); if (dreht) van.setRotation(fzKopf);
        if (fahrt) { kopf = mischWinkel(kopf, voraus, 0.12); cam.bearing = kopf; }
        else if (S.kamera === "nord") cam.bearing = 0;
        fz.setLngLat(pos);
        { let k = 1; while (k < cum.length - 1 && cum[k] < target) k++; const sp = map.getSource("spur"); // Straße entsteht direkt hinter dem Fahrzeug
          if (sp) sp.setData(fc([line(path.slice(0, k).concat([pos]), { col: farbe || "#e0913a", mit: mit || "auto" })])); if (fort) fort(k - 1 + Math.max(0, Math.min(1, (target - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1)))); }
        if (hand) { if (f < 1) anim = requestAnimationFrame(step); else { anim = null; done(); } return; } // Hand an der Karte: nur das Fahrzeug bewegen
        if (handZoom != null) { cam.zoom = handZoom; delete cam.pitch; }
        map.jumpTo(cam);
        if (f < 1) anim = requestAnimationFrame(step); else { anim = null; done(); }
      };
      anim = requestAnimationFrame(step);
    }
    function go(jump) {
      const auto = !!go.auto; go.auto = false; wartet = null; go.autoLauf = auto; // auto: vom Abspielen ausgelöst → hält bei Stopp an
      const tr = track(); const s = tr[S.idx]; if (!s) { render(); return; }
      const prev = go.last; go.last = s;
      S.seen.add(s.day);
      const d = dayOf(s.day);
      if (S.tiefe >= 2) { (d.mythen || []).forEach((m, k) => S.mythen.add(d.tag + "-" + k)); (d.wien_faden || []).forEach((m, k) => S.wien.add(d.tag + "-" + k)); }
      if (!van) { render(); return; } // Karte lädt noch
      const zoom = handZoom != null ? handZoom : S.tiefe >= 2 ? 10.2 : 8.4, pitch = narrow ? 45 : (S.tiefe >= 2 ? 68 : 58);
      const mit = jump || !prev ? (mitVon(ST[ST.indexOf(s) - 1], s)) : mitVon(prev, s);
      if (jump || !prev) { park = parkFuer(s); }
      const re = reiser.getElement(); const zeigReiser = (m) => { re.hidden = !(MIT[m] && MIT[m].i); if (!re.hidden) { re.textContent = MIT[m].i; re.dataset.mit = m; } };
      const finish = () => { if (mit === "auto") { park = s; van.setLngLat([s.lon, s.lat]); { const r = richtungAn(d, s.ri); if (r != null) van.setRotation(r); } }
        else if (park) van.setLngLat([park.lon, park.lat]);
        zeigReiser(mit); if (!re.hidden) reiser.setLngLat([s.lon, s.lat]); setzeFahrzeug(d); drawDone(); if (!(S.playing && halt(s) <= 400)) map.easeTo({ center: [s.lon, s.lat], zoom, pitch: S.kamera === "fahrt" && !narrow ? 70 : pitch, bearing: kameraZiel(s), duration: reduced ? 0 : 900 }); showFotos(d); render(); ton.ankunft(d); afterArrive(); };
      // Strecke erst einblenden, dann entlangfahren
      const vorher = (path, los) => { const vs = map.getSource("vorschau"); if (!vs || reduced) { los(); return; } vs.setData(fc([line(path)])); stopAnim(); clearTimeout(timer); clearTimeout(vorTimer);
        const fit = new maplibregl.LngLatBounds(path[0], path[0]); path.forEach((q) => fit.extend(q));
        if (!rollt && handZoom == null) map.fitBounds(fit, { padding: 80, maxZoom: zoom, duration: Math.min(1200, tz(900, S.tempo)), bearing: map.getBearing(), pitch: map.getPitch() });
        vorTimer = setTimeout(() => { vs.setData(fc([])); go.autoLauf = auto; if (auto && !S.playing) { wartet = () => { go.autoLauf = auto; los(); }; return; } los(); }, Math.min(1400, tz(rollt ? 350 : 1100, S.tempo))); };
      const von = mit === "auto" ? (park || prev) : prev;
      if (!jump && von && mit === "auto" && d.line && von.day === s.day && von.ri != null && s.ri != null && s.ri > von.ri) {
        const path = d.line.slice(von.ri, s.ri + 1); zeigReiser("auto");
        vorher(path, () => animateAlong(path, fahrDauer(path), finish, { zoom: Math.min(zoom, 9.2), pitch }, colOf(d), (i) => tagFort(s.day, von.ri + i)));
      } else if (!jump && von && mit === "auto" && d.line && s.day === von.day + 1 && s.ri != null && dayOf(von.day).line && von.ri != null) {
        const pl = dayOf(von.day).line.slice(von.ri); const path = pl.concat(d.line.slice(0, s.ri + 1)); zeigReiser("auto");
        vorher(path, () => animateAlong(path, fahrDauer(path), finish, { zoom: 8.6, pitch }, colOf(dayOf(von.day)), (i) => { const n = pl.length; if (i >= n) tagFort(s.day, i - n); }));
      } else if (!jump && prev && MIT[mit] && MIT[mit].i) { // Rad, zu Fuß, Boot, Bahn: eigenes Symbol, Auto bleibt stehen
        const strasse = MIT[mit].strasse && d.line && prev.day === s.day && prev.ri != null && s.ri != null && s.ri > prev.ri;
        const path = strasse ? d.line.slice(prev.ri, s.ri + 1) : [[prev.lon, prev.lat], [s.lon, s.lat]];
        zeigReiser(mit); reiser.setLngLat(path[0]);
        const kmh = MIT[mit].v || 0.4; // relativ zum Auto
        vorher(path, () => animateAlong(path, Math.max(900, fahrDauer(path) / kmh * 0.25), finish, { zoom: Math.max(zoom, 12), pitch }, colOf(d), null, reiser, mit));
      } else {
        stopAnim(); map.flyTo({ center: [s.lon, s.lat], zoom, pitch, bearing: kameraZiel(s), duration: reduced ? 0 : tz(1800, S.tempo), essential: true });
        finish();
      }
      render();
    }
    function afterArrive() { if (!S.playing) return; clearTimeout(timer); if (ton.liest()) { ton.danach(afterArrive); return; } const tr = track();
      if (S.idx >= tr.length - 1) { setPlay(false); return; }
      const h = halt(tr[S.idx]); if (h > 400) rollt = false;
      timer = setTimeout(() => { S.idx++; go.auto = true; go(false); }, h); }
    // Verweildauer an einer Station: kurz beim Durchfahren, länger bei Tagesziel/Highlights und großer Tiefe; schneller = kürzer
    function halt(s) { if (!s) return 0; const a = s.art || "besuch";
      let ms = 150 + (a === "uebernachtung" ? 900 : a === "besuch" ? 400 : 0) + (S.tiefe >= 2 ? 1200 : 0) + (S.tiefe >= 3 ? 1000 : 0);
      return Math.round(ms * Math.pow(0.75, S.tempo - 5)); }
    // Fahrstufe 0 = anhalten (letztes Tempo bleibt gemerkt), 1–10 = mit diesem Tempo fahren
    const gang = () => (S.playing ? S.tempo : 0);
    function fahrstufe(v) { v = Math.max(0, Math.min(TMAX, Math.round(v))); if (v === 0) { if (S.playing) setPlay(false); }
      else { S.tempo = v; if (!S.playing) setPlay(true); else render(); } broadcast(); }
    function setPlay(p) { S.playing = p; clearTimeout(timer); rollt = false;
      if (p && wartet) { const w = wartet; wartet = null; w(); render(); return; }
      if (p && !anim) { const tr = track(); if (S.idx < tr.length - 1) { S.idx++; go.auto = true; go(false); } else setPlay(false); } render(); }
    function step(n) { stopAnim(); clearTimeout(timer); clearTimeout(vorTimer); const tr = track(); S.idx = Math.min(tr.length - 1, Math.max(0, S.idx + n)); go(n < 0); }
    function gotoDay(t) { stopAnim(); let k = track().findIndex((s) => s.day >= t); if (k < 0) { S.thema = null; S.breite = 3; k = track().findIndex((s) => s.day >= t); } S.idx = Math.max(0, k); go(true); }
    function dayStep(n) { const tr = track(); const cur = (tr[S.idx] || {}).day || 1; let tgt = cur + n;
      while (tgt >= 1 && tgt <= DAYS.length && !tr.some((s) => s.day === tgt)) tgt += n;
      if (tgt >= 1 && tgt <= DAYS.length) gotoDay(tgt); }
    // Seitenleiste zusammenklappen (gemerkt), Touch-Dock, Karte als ausklappbares Blatt
    const side = document.getElementById("side");
    // Leiste beginnt unter dem Kopf; Tagesnummern bei schmalen Quadraten nur jeden 5. Tag
    const lage = () => { const kb = Math.round(document.getElementById("hudTop").getBoundingClientRect().bottom); document.body.style.setProperty("--kopf", kb + "px");
      if (document.body.classList.contains("touch")) { const rb = Math.round(document.getElementById("rail").getBoundingClientRect().bottom); document.body.style.setProperty("--reihe3", (rb + 6) + "px"); } if (document.body.classList.contains("touch") && !side.classList.contains("zu")) side.style.top = Math.round(document.getElementById("rail").getBoundingClientRect().bottom + 52) + "px"; else side.style.top = "";
      const rr = document.getElementById("railRow"); rr.classList.remove("eng"); };
    addEventListener("resize", lage); setTimeout(lage, 50); setTimeout(lage, 800);
    const setZu = (zu) => { side.classList.toggle("zu", zu); document.getElementById("sideKopf").setAttribute("aria-expanded", !zu); merk.set("sideZu", zu); if (typeof lage === "function") lage(); };
    setZu(merk.get("sideZu", matchMedia("(pointer: coarse)").matches || innerWidth <= 900) === true);
    document.getElementById("sideKopf").onclick = () => setZu(!side.classList.contains("zu"));
    { let sx = null, sy = 0, oben = true; const pan = document.getElementById("tonPanel");
      side.addEventListener("touchstart", (e) => { if (e.target.closest("input[type=range]")) { sx = null; return; } const t = e.touches[0]; sx = t.clientX; sy = t.clientY; oben = pan.scrollTop <= 0; }, { passive: true });
      side.addEventListener("touchend", (e) => { if (sx == null) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null; const zu = side.classList.contains("zu");
        if (!zu && ((dx < -60 && -dx > Math.abs(dy) * 1.5) || (dy > 60 && dy > Math.abs(dx) * 1.5 && oben))) setZu(true);
        else if (zu && (dx > 40 || dy < -40)) setZu(false); }, { passive: true }); }
    { let tx = null, ty = 0; const tab = document.getElementById("cardTab");
      tab.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
      tab.addEventListener("touchend", (e) => { if (tx == null) return; const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; tx = null;
        if (dx < -40 || dy < -40 || (Math.abs(dx) < 12 && Math.abs(dy) < 12)) { e.preventDefault(); setKarteZu(false); } }); }
    const touchModus = () => document.body.classList.toggle("touch", matchMedia("(pointer: coarse)").matches || innerWidth <= 900);
    touchModus(); addEventListener("resize", touchModus);
    document.getElementById("dock").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a;
      if (a === "prev") step(-1); else if (a === "next") step(1); else if (a === "dayPrev") dayStep(-1); else if (a === "dayNext") dayStep(1);
      else if (a === "play") { angehalten = false; setPlay(!S.playing); } else if (a === "suche") suche();
    });
    { const card = document.getElementById("card"); let x0 = null, y0 = 0;
      // Touch-Ereignisse statt Pointer: beim Wischen über scrollbaren Inhalt bricht der Browser Pointer-Gesten ab
      let kopf = false; // senkrechtes Wischen nur im Kopf der Karte (Griff, Tag, Ort) – darunter scrollt der Inhalt
      // Ziehblatt stufenlos: am Kopf nach oben ziehen = größer, und je größer, desto mehr Inhalt (Satz → Teaser/Fotos → alles); nach unten = kleiner, ganz unten = ausblenden
      let h0 = 0, zieht = false, hJetzt = 0;
      const stufeFuer = (h) => (h < innerHeight * 0.34 ? 1 : h < innerHeight * 0.6 ? 2 : 3);
      card.addEventListener("touchstart", (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; kopf = t.clientY - card.getBoundingClientRect().top < 90; h0 = card.getBoundingClientRect().height; zieht = false; }, { passive: true });
      card.addEventListener("touchmove", (e) => { if (x0 == null || !kopf || !document.body.classList.contains("touch")) return; const t = e.touches[0], dy = t.clientY - y0, dx = t.clientX - x0;
        if (!zieht && (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx))) return; zieht = true; e.preventDefault();
        hJetzt = Math.max(70, Math.min(innerHeight - 140, h0 - dy)); card.style.transition = "none"; card.style.height = hJetzt + "px"; card.style.maxHeight = "none";
        const st = stufeFuer(hJetzt); if (st > S.tiefe || (st < S.tiefe && dy > 0)) { S.tiefe = st; render(); } }, { passive: false });
      card.addEventListener("touchend", (e) => { if (!zieht) return; zieht = false; card.style.transition = "";
        if (hJetzt < innerHeight * 0.16) { card.style.height = ""; card.style.maxHeight = ""; setKarteZu(true); return; }
        S.tiefe = stufeFuer(hJetzt); autoHalt(); render(); broadcast(); merk.set("blattH", Math.round(hJetzt / innerHeight * 100)); x0 = null; }, { passive: true });
      card.addEventListener("touchend", (e) => { if (x0 == null) return; const t = e.changedTouches[0]; const dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
        if (e.target.closest(".gal")) return; // Fotostreifen wischt selbst
        if (dx > 60 && dx > Math.abs(dy) * 1.5) { setKarteZu(true); return; } }); }
    // Tageskarte ein-/ausblenden; ausgeblendet bleibt rechts ein schmaler Reiter sichtbar
    document.getElementById("card").addEventListener("click", (e) => { const b = e.target.closest(".blatt [data-st]"); if (!b) return; e.stopPropagation(); const v = +b.dataset.st; if (v === 0) setKarteZu(true); else setTiefe(v); });
    let tiefeRichtung = 1; // Tippen: 1→2→3→4→3→2→1 …
    function setTiefe(t) { handZoom = null; setTiefeOhne(t); }
    function setTiefeOhne(t) { S.tiefe = Math.max(document.body.classList.contains("touch") ? 1 : 0, Math.min(3, t)); autoHalt(); go(true); broadcast(); }
    function setKarteZu(zu) { if (!zu) { const c = document.getElementById("card"); c.style.height = ""; c.style.maxHeight = ""; if (S.tiefe > 1) S.tiefe = 1; } document.getElementById("card").classList.toggle("zu", zu); document.getElementById("cardTab").hidden = !zu; merk.set("karteZu", zu); autoHalt(); }
    // Lesen hält an: Tageskarte offen und Tiefe 3 oder 4 → Auto steht; zugeklappt oder zurück auf Tiefe 1–2 → fährt weiter
    let angehalten = false;
    function autoHalt() { const lesen = !document.getElementById("card").classList.contains("zu") && S.tiefe >= 2;
      if (lesen && S.playing) { angehalten = true; setPlay(false); broadcast(); }
      else if (!lesen && angehalten) { angehalten = false; setPlay(true); broadcast(); } }
    document.getElementById("cardTab").onclick = () => setKarteZu(false);
    if (merk.get("karteZu", false) === true) setKarteZu(true);
    // Tempo mit dem Daumen: auf „Fahren“ nach links/rechts ziehen
    { const pb = document.getElementById("dPlay"); let px = null, start = 0, gezogen = false; const blase = document.getElementById("tempoBlase");
      pb.addEventListener("pointerdown", (e) => { px = e.clientX; start = gang(); gezogen = false; pb.setPointerCapture(e.pointerId); });
      pb.addEventListener("pointermove", (e) => { if (px == null) return; const dx = e.clientX - px; if (Math.abs(dx) < 18 && !gezogen) return;
        gezogen = true; const t = Math.max(0, Math.min(TMAX, start + Math.round(dx / 22))); if (t !== gang()) { fahrstufe(t); if (t === 0 && start > 0) { S.tempo = start; render(); } } // bis 0 gezogen: Ausgangstempo merken
        blase.innerHTML = tachoSvg(gang()) + ` ${gang()} · ${TEMPO[gang()]}`; blase.style.background = tempoFarbe(gang()); blase.hidden = false; });
      const ende = () => { px = null; setTimeout(() => (blase.hidden = true), 700); };
      pb.addEventListener("pointerup", ende); pb.addEventListener("pointercancel", ende);
      pb.addEventListener("click", (e) => { if (gezogen) { e.stopImmediatePropagation(); e.preventDefault(); gezogen = false; } }, true); }
    { const r = document.getElementById("tempoR"); r.addEventListener("input", () => fahrstufe(+r.value)); }
    // Daumenfelder (Touch): rechts Tempo, links Stationen/Tage – gleiche Form, gleiche Höhe
    { const blase = document.getElementById("tempoBlase"); const zeig = (html, farbe) => { blase.innerHTML = html; blase.style.background = farbe || "var(--amber)"; blase.hidden = false; };
      const weg = () => setTimeout(() => (blase.hidden = true), 600);
      const tp = document.getElementById("tempoPad"); let y0 = null, st = 0, mem = 5, bewegt = false;
      tp.addEventListener("pointerdown", (e) => { y0 = e.clientY; st = gang(); mem = S.tempo; bewegt = false; tp.setPointerCapture(e.pointerId); });
      tp.addEventListener("pointermove", (e) => { if (y0 == null) return; const dy = y0 - e.clientY; if (!bewegt && Math.abs(dy) < 10) return; bewegt = true;
        const t = Math.max(0, Math.min(TMAX, st + Math.round(dy / 16))); if (t !== gang()) { fahrstufe(t); if (t === 0) { S.tempo = st || mem; render(); } }
        zeig(gang() ? `Tempo ${gang()} · ${TEMPO[gang()]}` : "Stopp", tempoFarbe(gang())); });
      const tEnde = () => { if (y0 == null) return; y0 = null; if (!bewegt) { angehalten = false; setPlay(!S.playing); broadcast(); zeig(S.playing ? `▶ weiter · Tempo ${S.tempo}` : "❚❚ Stopp", tempoFarbe(gang())); } weg(); };
      tp.addEventListener("pointerup", tEnde); tp.addEventListener("pointercancel", () => { y0 = null; weg(); });
      const np = document.getElementById("navPad"); let ny = null, nb = false; const was = (dy) => Math.abs(dy) < 22 ? 0 : (Math.abs(dy) < 110 ? 1 : 2) * Math.sign(dy);
      np.addEventListener("pointerdown", (e) => { ny = e.clientY; nb = false; np.setPointerCapture(e.pointerId); });
      np.addEventListener("pointermove", (e) => { if (ny == null) return; const dy = ny - e.clientY; if (Math.abs(dy) >= 10) nb = true; if (!nb) return; const w = was(dy);
        np.dataset.w = w; zeig(["◀◀ voriger Tag", "◀ vorige Station", "…", "nächste Station ▶", "nächster Tag ▶▶"][w + 2]); });
      np.addEventListener("pointerup", (e) => { if (ny == null) return; const dy = ny - e.clientY; ny = null; np.dataset.w = 0;
        if (!nb) { const r = np.getBoundingClientRect(); step(e.clientY < r.top + r.height / 2 ? 1 : -1); } else { const w = was(dy); if (Math.abs(w) === 1) step(w); else if (w) dayStep(w / 2); } weg(); });
      np.addEventListener("pointercancel", () => { ny = null; np.dataset.w = 0; weg(); }); }
    document.getElementById("fernBtn").onclick = () => chooseMode();
    function setBreite(v) { S.breite = v; const cur = (go.last || ST[0]).day; S.idx = Math.max(0, track().findIndex((s) => s.day >= cur)); go(true); broadcast(); }
    function setRole(k) { const r = ROLLEN[k]; if (!r) return; S.rolle = k; Object.assign(S, { tempo: r.s.tempo, breite: r.s.breite, tiefe: r.s.tiefe, thema: r.s.thema });
      document.getElementById("roles").hidden = true; const cur = (go.last || ST[0]).day; S.idx = Math.max(0, track().findIndex((s) => s.day >= cur)); go(true); setPlay(r.s.play); }

    function showFotos(d) { fotoMarkers.forEach((m) => m.remove()); fotoMarkers = [];
      if (S.tiefe < 2) return;
      (d.fotos || []).forEach((f) => { if (typeof f.lat !== "number") return; const e = document.createElement("button"); e.className = "fpin"; e.style.backgroundImage = `url("${f.url}")`; e.setAttribute("aria-label", "Foto: " + f.text); e.onclick = () => openPhoto(f);
        fotoMarkers.push(new maplibregl.Marker({ element: e }).setLngLat([f.lon, f.lat]).addTo(map)); }); }

    // ---------- Anzeige ----------
    function render() {
      const tr = track(); const s = tr[S.idx]; const d = s ? dayOf(s.day) : DAYS[0];

      document.querySelectorAll("#tonPanel .seg").forEach((g) => [...g.children].forEach((b) => b.classList.toggle("on", b.dataset.v === (g.dataset.ks === "musik" ? (S.musik ? "an" : "aus") : String(S[g.dataset.ks])))));
      document.getElementById("chipMyth").textContent = S.mythen.size + "/" + DAYS.reduce((a, x) => a + (x.mythen || []).length, 0);
      document.getElementById("chipWien").textContent = S.wien.size + "/" + DAYS.reduce((a, x) => a + (x.wien_faden || []).length, 0);
      const kmSoFar = DAYS.filter((x) => x.tag < d.tag).reduce((a, x) => a + ((x.route && x.route.km) || 0), 0);
      document.getElementById("chipKm").textContent = Math.round(kmSoFar).toLocaleString("de-AT") + " / " + Math.round(kmTotal).toLocaleString("de-AT");
      [...row.querySelectorAll(".tick")].forEach((b, k) => { const dd = DAYS[k]; b.classList.toggle("cur", dd.tag === d.tag); b.classList.toggle("seen", S.seen.has(dd.tag)); b.classList.toggle("dim", !dayMatches(dd)); });
      { const c = row.querySelector(".tick.cur"); if (c && row.scrollWidth > row.clientWidth + 2) { const z = row.scrollLeft + (c.getBoundingClientRect().left - row.getBoundingClientRect().left) - row.clientWidth / 2 + c.offsetWidth / 2; if (Math.abs(row.scrollLeft - z) > c.offsetWidth) row.scrollTo({ left: z, behavior: reduced ? "auto" : "smooth" }); } }
      ST.forEach((x, k) => pinEls[k] && pinEls[k].classList.toggle("cur", x === s));
      document.getElementById("metaDay").textContent = "Tag " + d.tag;
      { const g = gang(), tt = document.getElementById("tempoTxt");
        if (tt) { tt.textContent = g ? `Stufe ${g}/10 · ${TEMPO[g]}` : `Stufe 0 · steht (zuletzt ${S.tempo})`; tachoSetzen(document.getElementById("tachoGross"), g, true);
          const r = document.getElementById("tempoR"); r.value = g; r.style.setProperty("--f", tempoFarbe(g)); }
        { const tp = document.getElementById("tempoPad"); if (tp) { const lv = g || S.tempo; tp.querySelector(".pF").style.height = (lv / TMAX * 100) + "%"; tp.style.setProperty("--tf", g ? tempoFarbe(g) : "#f3ecdc");
          tp.classList.toggle("steht", !g); tp.querySelector(".pZ").textContent = g ? g : "❚❚"; } }
        const dp = document.getElementById("dPlay");
        if (dp) { if (dp.querySelector(".lbl") || !dp.querySelector("svg")) dp.innerHTML = ""; tachoSetzen(dp, g);
          dp.setAttribute("aria-label", g ? `Fährt mit Stufe ${g} – tippen zum Anhalten` : `Steht – tippen zum Weiterfahren mit Stufe ${S.tempo}`);
          dp.style.setProperty("--tf", tempoFarbe(g)); dp.classList.toggle("steht", !g); dp.classList.toggle("vollgas", g >= 9);
          dp.title = g ? `Stufe ${g}/10 – tippen = Stopp, seitlich ziehen = schneller/langsamer` : `Steht – tippen = weiter mit Stufe ${S.tempo}, nach rechts ziehen = anfahren`; } }
      document.getElementById("metaDate").textContent = fmtDate(d.datum);
      document.getElementById("metaMode").textContent = `${S.playing ? "▶ fährt" : "❚❚ steht"} · Tempo ${TEMPO[S.tempo]} · Breite ${["", "Highlights", "Stationen", "alles"][S.breite]}${S.thema ? " · Thema " + themaName(S.thema) : ""}`;

      let h = `<span class="day">Tag ${d.tag} · ${esc(fmtDate(d.datum))} · ${(d.land || []).map((c) => `<span class="landChip" style="--lc:${(COUNTRY[c] || {}).c || "#e0913a"}">${flagge(c)} ${esc((COUNTRY[c] || {}).n || c)}</span>`).join(" → ")}</span><h2>${esc((s && s.name) || d.titel || "Ohne Eintrag")}</h2>`;
      if (d.titel && s) h += `<span class="stn">${esc(d.titel)}${s.notiz ? " · " + esc(s.notiz) : ""}${d.route && d.route.km ? ` · ${String(d.route.km).replace(".", ",")} km` : ""}</span>`;
      { const w = WETTER[d.tag], so = d.sonne; const bits = [];
        if (w && w.max != null) bits.push(`${wmoIcon(w.code)} ${Math.round(w.max)}° / ${Math.round(w.min)}°${w.regen >= 1 ? ` · ${String(Math.round(w.regen * 10) / 10).replace(".", ",")} mm` : ""}`);
        if (so) bits.push(`↑ ${so.auf} · ↓ ${so.unter}`);
        if (bits.length) h += `<span class="wx" title="Wetter am Übernachtungsort (Open-Meteo) · Sonnenauf- und -untergang">${bits.join(" · ")}</span>`; }
      if (d.line && d.route && d.route.km) h += `<div class="tagFort" aria-label="Fortschritt des Tages"><i></i><span></span></div>`;
      h += `<div class="depth" aria-label="Tiefe ${S.tiefe + 1} von 4">Tiefe <b>${S.tiefe + 1}</b>/4 ${[0, 1, 2, 3].map((k) => `<i class="${k <= S.tiefe ? "on" : ""}"></i>`).join("")}</div>`;
      if (S.tiefe >= 1 && d.satz) h += `<p class="lead">${esc(d.satz)}</p>`;
      { const pa = (d.passend || []).concat((MAUERN || []).filter((m) => m.tag === d.tag));
        if (S.tiefe >= 1 && pa.length) h += `<div class="passend"><span class="pl">Dazu passend</span>${pa.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.ort ? x.ort + " · " : "")}${x.gleicherTag ? "an diesem Tag" : "früher/später hier, " + esc(x.jahr)}">${x.symbol} ${esc(x.titel)}${x.gleicherTag ? "" : ` <small>${esc(x.jahr)}</small>`}</a>`).join("")}</div>`; }
      if (S.tiefe >= 1 && (d.clips || []).length) h += `<div class="clips">${d.clips.map((c, k) => `<button class="clip" data-c="${k}" aria-label="Video von Tag ${d.tag} abspielen">${c.poster ? `<img src="${esc(c.poster)}" alt="" loading="lazy">` : ""}<span>▶ Video</span></button>`).join("")}</div>`;
      const fotos = d.fotos || [];
      if (S.tiefe >= 2) {
        if (d.teaser) h += `<p>${esc(d.teaser)}</p>`;
        if (fotos.length) h += S.tiefe >= 3 ? `<div class="gal">${fotos.map((f, k) => `<button data-f="${k}" aria-label="${esc(f.text)}"><img src="${esc(f.url)}" alt="" loading="lazy"></button>`).join("")}</div>`
                                            : ((hi) => `<button class="hero" data-f="${hi}" aria-label="${esc(fotos[hi].text)}"><img src="${esc(fotos[hi].url)}" alt="${esc(fotos[hi].text)}"></button>`)(Math.max(0, fotos.findIndex((f) => !f.hoch)));
        else h += `<div class="photo-ph">Fotos folgen</div>`;
        h += `<div class="tags">${(d.themen || []).map((t) => `<span class="tag ${t === S.thema ? "hit" : ""}">${esc(themaName(t))}</span>`).join("")}</div>`;
      }
      if (S.tiefe >= 2 && (d.mythen || []).length) h += `<div class="sect"><h3>Mythencheck</h3>${d.mythen.slice(0, S.tiefe >= 3 ? 9 : 1).map((m) => `<div class="myth"><span class="claim">${esc(m.behauptung)}</span>${S.tiefe >= 3 ? `<span class="fact">${esc(m.befund)}</span>` : ""}</div>`).join("")}</div>`;
      if (S.tiefe >= 3) {
        if ((d.wien_faden || []).length) h += `<div class="sect"><h3>Faden nach Österreich</h3>${d.wien_faden.map((w) => `<p style="font-size:14px"><b>${esc(w.person_oder_thema)}</b> – ${esc(w.bezug)}</p>`).join("")}</div>`;
        const all = d.stationen || []; if (all.length > 1) h += `<div class="sect"><h3>Alle Stationen</h3><p class="note">${all.map((x) => esc(x.name)).join(" → ")}</p></div>`;
        if (d.seite) h += `<a class="more" href="${esc(d.seite)}">Ganzes Tagebuch von Tag ${d.tag} lesen →</a>`;
      }
      if (d.status === "fehlt") h += `<p class="note">Für diesen Tag gibt es noch keinen Eintrag.</p>`;
      const card = document.getElementById("card"); card.innerHTML = `<div class="blatt" aria-label="Griff: nach oben ziehen = mehr, nach unten = weniger"><i class="griff" aria-hidden="true"></i></div><button class="cardX" aria-label="Tagesübersicht ausblenden (T)" title="ausblenden (T)">›</button>` + h; card.dataset.tiefe = S.tiefe; if (!anim) tagFort(d.tag, (s && s.ri) || 0); setTimeout(() => { try { polster(); } catch (e) {} }, 0);
      card.querySelector(".cardX").onclick = () => setKarteZu(true);
      { const ct = document.getElementById("cardTab"); ct.innerHTML = `<i class="griff" aria-hidden="true"></i><span>${esc(d.titel || (s && s.name) || "Tag " + d.tag)}</span>`; ct.title = `Tag ${d.tag} · ${d.titel || ""} – Tagesübersicht einblenden`; }
      card.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => openPhoto(fotos[+b.dataset.f]));
      card.querySelectorAll("[data-c]").forEach((b) => b.onclick = () => { const c = d.clips[+b.dataset.c]; const box = document.createElement("div"); box.className = "tzBox";
        box.innerHTML = `<div class="tzIn"><video src="${esc(c.url)}" ${c.poster ? `poster="${esc(c.poster)}"` : ""} controls autoplay muted playsinline></video><p class="note">Tag ${d.tag} · Ton per Klick auf 🔈 im Video</p><button class="big" data-x>Schließen</button></div>`;
        box.onclick = (e) => { if (e.target === box || e.target.hasAttribute("data-x")) box.remove(); }; document.body.appendChild(box); });
      broadcast();
    }

    // ---------- Tastatur ----------
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea")) return;
      if (!lb.hidden) {
        if (e.key === "Escape") closeLb();
        else if (e.key === "ArrowRight" || e.key === " ") { lbStep(1); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { lbStep(-1); e.preventDefault(); }
        return;
      }
      if (e.key === "ArrowRight") { e.shiftKey ? dayStep(1) : step(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { e.shiftKey ? dayStep(-1) : step(-1); e.preventDefault(); }
      else if (e.key === " ") { setPlay(!S.playing); e.preventDefault(); }
      else if (e.key === "ArrowDown") { S.tiefe = Math.min(3, S.tiefe + 1); go(true); e.preventDefault(); }
      else if (e.key === "ArrowUp") { S.tiefe = Math.max(0, S.tiefe - 1); go(true); e.preventDefault(); }
      else if (e.key === "+" || e.key === "=") fahrstufe(gang() + 1);
      else if (e.key === "-" || e.key === "_") fahrstufe(gang() - 1);
      else if (e.key === "b" || e.key === "B") setBreite(S.breite % 3 + 1);
      else if (e.key === "t" || e.key === "T") setKarteZu(!document.getElementById("card").classList.contains("zu"));
      else if (e.key === "k" || e.key === "K") setKamera(KAMERA[(KAMERA.findIndex((k) => k[0] === S.kamera) + 1) % KAMERA.length][0]);
      else if ((e.key === "m" || e.key === "M") && HAT_MUSIK) ton.setMusik(!S.musik);
      else if ((e.key === "v" || e.key === "V") && HAT_VL) ton.setVorlesen(VORLESEN[(VORLESEN.findIndex((k) => k[0] === S.vorlesen) + 1) % VORLESEN.length][0]);
      else if (e.key === "f" || e.key === "F") { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
    });

    // ---------- Kopplung (Weiterleitung über öffentliche MQTT-Broker) ----------
    const ctlSeen = new Map();
    function stateMsg() { const s = track()[S.idx]; const d = s ? dayOf(s.day) : DAYS[0];
      return { t: "state", tag: d.tag, datum: d.datum, ort: (s && s.name) || "", satz: d.satz || "", playing: S.playing, tempo: S.tempo, breite: S.breite, tiefe: S.tiefe, thema: S.thema, rolle: S.rolle, kamera: S.kamera, musik: S.musik, vorlesen: S.vorlesen, hatMusik: HAT_MUSIK, hatVorlesen: HAT_VL, sprecher: ton.sprecher(), foto: lbIdx >= 0 ? { tag: ALLF[lbIdx].day, i: ALLF[lbIdx].i + 1, n: ALLF[lbIdx].n, url: ALLF[lbIdx].f.url, text: (ALLF[lbIdx].f.text || "").slice(0, 120), zeit: ALLF[lbIdx].f.zeit || "" } : null }; }
    let link = null;
    function broadcast() { if (link) link.send("state", stateMsg(), true); }
    function apply(m) {
      if (!m || typeof m !== "object") return;
      if (m.foto === "auf") { const d = dayOf((go.last || ST[0]).day); if (d && d.fotos && d.fotos.length) openPhoto(d.fotos[0]); return; }
      if (m.foto === "zu") { closeLb(); return; }
      if (!lb.hidden && (m.step === 1 || m.step === -1)) { lbStep(m.step); return; }
      if (!lb.hidden && (m.day === 1 || m.day === -1)) { const cur = ALLF[lbIdx].day; const k = m.day > 0 ? ALLF.findIndex((x) => x.day > cur) : (() => { const prev = [...ALLF].reverse().find((x) => x.day < cur); return prev ? ALLF.findIndex((x) => x.day === prev.day) : -1; })(); if (k >= 0) showLb(k); return; }
      document.getElementById("roles").hidden = true;
      if (m.rolle && ROLLEN[m.rolle]) { setRole(m.rolle); return; }
      let redraw = false;
      if (+m.tempo >= 1 && +m.tempo <= TMAX) S.tempo = Math.round(+m.tempo);
      if ([1, 2, 3].includes(m.breite)) { S.breite = m.breite; redraw = true; }
      if ([0, 1, 2, 3].includes(m.tiefe)) { S.tiefe = m.tiefe; }
      if ("thema" in m && (m.thema === null || THEMEN.some((t) => t[0] === m.thema))) { S.thema = m.thema; redraw = true; }
      if (redraw) { const cur = (go.last || ST[0]).day; S.idx = Math.max(0, track().findIndex((s) => s.day >= cur)); drawDone(); }
      if (m.step === 1 || m.step === -1) step(m.step);
      else if (m.day === 1 || m.day === -1) dayStep(m.day);
      else if ("tiefe" in m || redraw) go(true);
      if (typeof m.playing === "boolean") setPlay(m.playing);
      if (KAMERA.some((k) => k[0] === m.kamera)) setKamera(m.kamera);
      if (typeof m.musik === "boolean") ton.setMusik(m.musik);
      if (VORLESEN.some((k) => k[0] === m.vorlesen)) ton.setVorlesen(m.vorlesen);
      if (m.orbit && typeof m.orbit.b === "number" && S.kamera !== "frei") setKamera("frei");
      if (m.orbit && typeof m.orbit.b === "number") map.easeTo({ bearing: map.getBearing() + Math.max(-40, Math.min(40, m.orbit.b)), pitch: Math.max(0, Math.min(80, map.getPitch() + Math.max(-20, Math.min(20, +m.orbit.p || 0)))), duration: 250 });
      if (m.zoom === 1 || m.zoom === -1) map.easeTo({ zoom: map.getZoom() + m.zoom, duration: 300 });
      render();
    }
    function linkUi() { const now = Date.now(); for (const [k, t] of ctlSeen) if (now - t > 25000) ctlSeen.delete(k);
      const n = ctlSeen.size; document.getElementById("linkDot").classList.toggle("on", n > 0);
      document.getElementById("linkTxt").textContent = n ? (n === 1 ? "Smartphone verbunden" : n + " Controller verbunden") : (link && link.up() ? "Kein Smartphone verbunden" : "Verbinde …"); }
    function newCode() { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(6)); r.forEach((x) => s += a[x % a.length]); return s; }
    let code; try { code = sessionStorage.getItem("atlasCode"); } catch (e) {}
    if (!code || !/^[a-z0-9]{6}$/.test(code)) code = newCode();
    try { sessionStorage.setItem("atlasCode", code); } catch (e) {}
    const url = `${location.origin}${location.pathname}#c-${code}`;
    document.getElementById("codeTxt").textContent = code;
    try { const q = qrcode(0, "M"); q.addData(url); q.make(); document.getElementById("qr").innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) {}
    link = makeLink(code, "ctl", (m) => {
      if (!m || typeof m !== "object") return;
      if (m.t === "hi") { const neu = !ctlSeen.has(m.id); ctlSeen.set(m.id, Date.now()); linkUi(); if (neu) broadcast(); return; }
      if (m.id) ctlSeen.set(m.id, Date.now());
      apply(m);
    }, linkUi);
    setInterval(linkUi, 5000);
  }

  // ---------- Weiterleitung: zwei öffentliche Broker parallel, Nachrichten mit ID gegen Doppelte ----------
  function makeLink(code, listen, onMsg, onStatus) {
    const BROKERS = ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt"];
    const base = `rcatlas/v1/${code}/`;
    const seen = new Set(); const clients = [];
    if (!window.mqtt) { onStatus && onStatus(); return { send() {}, up: () => false }; }
    for (const u of BROKERS) {
      let c; try { c = mqtt.connect(u, { clientId: "rca-" + Math.random().toString(36).slice(2, 10), clean: true, connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 30 }); } catch (e) { continue; }
      c.on("connect", () => { c.subscribe(base + listen, { qos: 0 }); onStatus && onStatus(); });
      c.on("close", () => onStatus && onStatus());
      c.on("error", () => {});
      c.on("message", (topic, payload) => {
        let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
        if (!m || !m._i || seen.has(m._i)) return; seen.add(m._i); if (seen.size > 500) seen.clear();
        onMsg(m);
      });
      clients.push(c);
    }
    return {
      up: () => clients.some((c) => c.connected),
      send(topic, m, retain) {
        const msg = JSON.stringify(Object.assign({}, m, { _i: Math.random().toString(36).slice(2) + Date.now().toString(36) }));
        let ok = false; clients.forEach((c) => { if (c.connected) { c.publish(base + topic, msg, { qos: 0, retain: !!retain }); ok = true; } });
        return ok;
      },
    };
  }

  // =========================================================== CONTROLLER
  function startController(code) {
    APP.insertAdjacentHTML("beforeend", `<div id="ctl">
      <div class="ctlHead"><h1>Reise-Atlas<br>Controller</h1><span class="status" id="ctlStatus">verbinde mit ${esc(code)} …</span></div>
      <div class="now"><span class="d" id="cDay">–</span><span class="o" id="cOrt">Bildschirm suchen …</span><span class="s" id="cSatz">Der Atlas muss am Mac oder TV geöffnet sein.</span></div>
      <div class="pad">
        <button class="big" id="bPrev">◀<small>Station</small></button>
        <button class="big primary" id="bPlay"><span>Fahren</span><small>Play</small></button>
        <button class="big" id="bNext">▶<small>Station</small></button>
        <button class="big" id="bDayPrev">«<small>Tag</small></button>
        <button class="big" id="bMore">Mehr<small>tiefer</small></button>
        <button class="big" id="bDayNext">»<small>Tag</small></button>
      </div>
      <button class="big" id="bFoto">Fotos<small>groß ansehen</small></button>
      <div id="cFoto" hidden>
        <div id="cFotoBox" aria-label="Foto – wischen zum Blättern"><img id="cFotoImg" alt=""></div>
        <div class="cFotoCap" id="cFotoCap"></div>
        <div class="pad" style="grid-template-columns:1fr 1fr 1fr"><button class="big" id="cFPrev">◀<small>Foto</small></button><button class="big" id="cFClose">✕<small>schließen</small></button><button class="big" id="cFNext">▶<small>Foto</small></button></div>
      </div>
      <div class="secTitle">Regler</div>
      <div class="sliders">
        <div class="sl"><label>Tempo <b id="cTempoTxt"></b></label><input type="range" id="cTempo" min="0" max="10" step="1"></div>
        <div class="sl"><label>Breite</label><div class="seg" style="--n:3" data-k="breite"><button data-v="1">Highlights</button><button data-v="2">Stationen</button><button data-v="3">alles</button></div></div>
        <div class="sl"><label>Tiefe</label><div class="seg" style="--n:4" data-k="tiefe"><button data-v="0">Ort</button><button data-v="1">Satz</button><button data-v="2">Teaser</button><button data-v="3">alles</button></div></div>
      </div>
      <div class="secTitle">Thema</div><div class="pills" id="cThemen"></div>
      <div class="pills" id="cRollen" hidden></div>
      <div class="secTitle">Kamera</div>
      <div class="seg" style="--n:3" data-ks="kamera">${KAMERA.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div>
      <div id="orbit">Wischen: links/rechts drehen, hoch/runter neigen</div>
      <div class="pad" style="grid-template-columns:1fr 1fr"><button class="big" id="bZoomOut">−<small>weiter weg</small></button><button class="big" id="bZoomIn">+<small>näher</small></button></div>
      <div id="cTon" hidden><div class="secTitle">Ton</div>
        <div class="sliders">
          <div class="sl" id="cMusikSl" hidden><label>Musik</label><div class="seg" style="--n:2" data-ks="musik"><button data-v="aus">aus</button><button data-v="an">an</button></div></div>
          <div class="sl" id="cVlSl" hidden><label>Vorlesen</label><div class="seg vl" data-ks="vorlesen">${VORLESEN.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div></div>
        </div><p class="note" id="cVlInfo"></p></div>
    </div>`);
    const $ = (id) => document.getElementById(id);
    let scr = null;
    const tp = $("cThemen"); tp.insertAdjacentHTML("beforeend", `<button data-v="">alle</button>` + THEMEN.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join(""));
    const rp = $("cRollen"); rp.innerHTML = Object.entries(ROLLEN).map(([k, r]) => `<button data-v="${k}">${r.n}</button>`).join("");
    const myId = Math.random().toString(36).slice(2, 10);
    let link = null;
    const send = (m) => { if (!link || !link.send("ctl", Object.assign({ id: myId }, m))) { $("ctlStatus").textContent = "nicht verbunden – bitte kurz warten"; return; } try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
    $("bPrev").onclick = () => send({ step: -1 }); $("bNext").onclick = () => send({ step: 1 });
    $("bDayPrev").onclick = () => send({ day: -1 }); $("bDayNext").onclick = () => send({ day: 1 });
    $("bPlay").onclick = () => send({ playing: !(scr && scr.playing) });
    $("bMore").onclick = () => send({ tiefe: Math.min(3, ((scr && scr.tiefe) || 0) + 1) });
    $("bFoto").onclick = () => send({ foto: scr && scr.foto ? "zu" : "auf" });
    $("cFPrev").onclick = () => send({ step: -1 }); $("cFNext").onclick = () => send({ step: 1 }); $("cFClose").onclick = () => send({ foto: "zu" });
    const fb = $("cFotoBox"); let fx = null, fy = null;
    fb.addEventListener("pointerdown", (e) => { fx = e.clientX; fy = e.clientY; });
    fb.addEventListener("pointerup", (e) => { if (fx == null) return; const dx = e.clientX - fx, dy = e.clientY - fy; fx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) send({ step: dx < 0 ? 1 : -1 }); });
    $("bZoomIn").onclick = () => send({ zoom: 1 }); $("bZoomOut").onclick = () => send({ zoom: -1 });
    { const r = document.getElementById("cTempo"); r.addEventListener("change", () => send(+r.value ? { tempo: +r.value, playing: true } : { playing: false })); r.addEventListener("input", () => { r.style.setProperty("--f", tempoFarbe(+r.value)); document.getElementById("cTempoTxt").textContent = r.value + "/10"; }); }
    document.querySelectorAll("#ctl .seg[data-k]").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send({ [g.dataset.k]: +b.dataset.v }); }));
    document.querySelectorAll("#ctl .seg[data-ks]").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return;
      send({ [g.dataset.ks]: g.dataset.ks === "musik" ? b.dataset.v === "an" : b.dataset.v }); }));
    tp.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send({ thema: b.dataset.v || null }); });
    rp.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send({ rolle: b.dataset.v }); });
    const pad = $("orbit"); let sx = 0, sy = 0;
    pad.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; pad.setPointerCapture(e.pointerId); });
    pad.addEventListener("pointermove", (e) => { if (!pad.hasPointerCapture(e.pointerId)) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) < 14) return; sx = e.clientX; sy = e.clientY; send({ orbit: { b: dx * 0.6, p: -dy * 0.4 } }); });
    function show(p) { scr = p;
      $("cDay").textContent = "Tag " + p.tag + " · " + fmtDate(p.datum); $("cOrt").textContent = p.ort || ""; $("cSatz").textContent = p.tiefe >= 1 ? (p.satz || "") : "";
      $("bPlay").firstChild.textContent = p.playing ? "Anhalten" : "Fahren";
      const fo = p.foto; $("cFoto").hidden = !fo;
      if (fo) { if ($("cFotoImg").getAttribute("src") !== fo.url) $("cFotoImg").src = fo.url; $("cFotoImg").alt = fo.text || "";
        $("cFotoCap").textContent = `Tag ${fo.tag} · ${fo.i}/${fo.n}${fo.zeit ? " · " + fo.zeit : ""}${fo.text ? " · " + fo.text : ""}`;
        if (!show.fotoWasOpen) $("cFoto").scrollIntoView({ behavior: "smooth", block: "start" }); }
      show.fotoWasOpen = !!fo;
      $("bFoto").firstChild.textContent = fo ? "Foto schließen" : "Fotos";
      $("bFoto").querySelector("small").textContent = fo ? `Tag ${fo.tag} · ${fo.i}/${fo.n} – ◀ ▶ blättern` : "groß ansehen";
      $("bPrev").querySelector("small").textContent = fo ? "Foto" : "Station"; $("bNext").querySelector("small").textContent = fo ? "Foto" : "Station";
      { const r = document.getElementById("cTempo"); if (r && document.activeElement !== r && p.tempo) { const g = p.playing ? p.tempo : 0; r.value = g; r.style.setProperty("--f", tempoFarbe(g)); document.getElementById("cTempoTxt").textContent = g + "/10 · " + (TEMPO[g] || ""); } }
      document.querySelectorAll("#ctl .seg[data-k]").forEach((g) => [...g.children].forEach((b) => b.classList.toggle("on", +b.dataset.v === p[g.dataset.k])));
      document.querySelectorAll("#ctl .seg[data-ks]").forEach((g) => [...g.children].forEach((b) => b.classList.toggle("on", b.dataset.v === (g.dataset.ks === "musik" ? (p.musik ? "an" : "aus") : p[g.dataset.ks]))));
      $("cTon").hidden = !(p.hatMusik || p.hatVorlesen); $("cMusikSl").hidden = !p.hatMusik; $("cVlSl").hidden = !p.hatVorlesen;
      $("cVlInfo").textContent = p.sprecher ? `🔊 ${SPRECHER[p.sprecher] || p.sprecher} liest gerade` : "";
      [...tp.children].forEach((b) => b.classList.toggle("on", (b.dataset.v || null) === (p.thema || null)));
      [...rp.children].forEach((b) => b.classList.toggle("on", b.dataset.v === p.rolle)); }
    let lastState = 0;
    const status = () => { const up = link && link.up(); $("ctlStatus").textContent = !up ? "verbinde …" : (Date.now() - lastState < 30000 ? "verbunden" : "Bildschirm nicht gefunden");
      if (up && Date.now() - lastState >= 30000) $("cSatz").textContent = "Ist der Atlas am Mac offen? Code am Bildschirm: " + code + "."; };
    link = makeLink(code, "state", (m) => { if (m.t === "state") { lastState = Date.now(); show(m); status(); } }, () => { status(); if (link && link.up()) link.send("ctl", { t: "hi", id: myId }); });
    setInterval(() => { if (link && link.up()) link.send("ctl", { t: "hi", id: myId }); status(); }, 8000);
  }
})();
