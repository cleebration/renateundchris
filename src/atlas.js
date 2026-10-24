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
  const THEMEN = [["geschichte","Geschichte"],["habsburg","Wien-Faden"],["mythencheck","Legenden"],["kulinarik","Essen"],["kloster","Klöster"],["burg","Burgen"],["natur","Natur"],["strand","Strand"],["grenze","Grenzen"],["panne","Pannen"],["eisenbahn","Eisenbahn"],["faehre","Fähren"]];
  const ROLLEN = {
    zuschauer:{n:"Zuschauer",k:"im Flug",d:"Die ganze Route am Stück. Nur Orte und ein Satz pro Tag.",s:{tempo:3,breite:1,tiefe:1,thema:null,play:true}},
    entdecker:{n:"Entdecker",k:"frei",d:"Selbst fahren, anhalten, jede Station öffnen.",s:{tempo:1,breite:3,tiefe:2,thema:null,play:false}},
    zeitreisender:{n:"Zeitreisender",k:"Geschichte",d:"Durch die Schichten: Antike, Osmanen, Habsburg.",s:{tempo:1,breite:2,tiefe:3,thema:"geschichte",play:false}},
    geniesser:{n:"Genießer",k:"Kulinarik",d:"Lokale, Gerichte und woher sie kommen.",s:{tempo:2,breite:3,tiefe:2,thema:"kulinarik",play:false}},
    abenteurer:{n:"Abenteurer",k:"Pannen & Grenzen",d:"Offroad, Reifen, Staus – die ehrliche Seite.",s:{tempo:2,breite:3,tiefe:2,thema:"panne",play:false}},
    wien:{n:"Wien-Spurensucher",k:"Quest",d:"Folge den Fäden, die von hier nach Wien führen.",s:{tempo:2,breite:2,tiefe:3,thema:"habsburg",play:false}}
  };
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
  function fahrzeugSvg(k) {
    const f = FAHRZEUGE[k] || FAHRZEUGE.l3, W = 40, H = Math.round(f.h / f.w * 40), glas = "#8fb8cc";
    if (f.form === "pkw") return `<svg viewBox="0 0 ${W} ${H}" width="${f.w}" height="${f.h}" aria-hidden="true">
      <rect x="2" y="2" width="36" height="${H - 4}" rx="11" fill="${f.lack}" stroke="${f.rand}" stroke-width="2"/>
      <path d="M8 ${H * .28} Q20 ${H * .22} 32 ${H * .28} L30 ${H * .38} Q20 ${H * .35} 10 ${H * .38}Z" fill="${glas}"/>
      <rect x="9" y="${H * .4}" width="22" height="${H * .27}" rx="4" fill="${f.dach}"/>
      <path d="M10 ${H * .7} Q20 ${H * .73} 30 ${H * .7} L31 ${H * .78} Q20 ${H * .8} 9 ${H * .78}Z" fill="${glas}"/>
      <rect x="0" y="${H * .3}" width="3" height="5" rx="1" fill="${f.lack}"/><rect x="37" y="${H * .3}" width="3" height="5" rx="1" fill="${f.lack}"/>
      <rect x="7" y="4" width="6" height="3" rx="1.5" fill="#fff6d8"/><rect x="27" y="4" width="6" height="3" rx="1.5" fill="#fff6d8"/></svg>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="${f.w}" height="${f.h}" aria-hidden="true">
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
  else if (location.hash === "#bildschirm" || !narrow) startScreen();
  else chooseMode();

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
    document.getElementById("asScreen").onclick = () => { document.querySelector(".choose").remove(); startScreen(); };
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
        <div class="brandRow"><a class="backBtn" href="/atlas/" aria-label="Zurück zur Weltkugel mit allen Reisen">← Alle Reisen</a><a class="brand" href="/reisen"><span class="eyebrow">Renate &amp; Chris · Reise-Atlas</span><h1>${esc(TITLE)}</h1></a></div>
        <div class="chips">
          <button class="chip warn" id="tonChip" hidden title="Der Browser hat den Ton blockiert">🔇 Ton einschalten</button>
          <span class="chip"><i class="dot" id="linkDot"></i><b id="linkTxt">Kein Smartphone verbunden</b></span>
          <button class="chip narrowOnly" id="tonBtn" aria-expanded="false">Kamera &amp; Ton</button>
          <button class="chip" id="sucheBtn" title="In dieser Reise suchen (Taste /)">🔎 Suchen</button>
          <a class="chip" href="/atlas/statistik/#${esc(REISE)}" title="Kilometer, Wetter, Rekorde und Abzeichen">📊 Statistik</a>
          <button class="chip" id="chipRoleBtn" title="Rolle wechseln (R)">Rolle <b id="chipRole">–</b></button>
          <span class="chip opt">Legenden <b class="mono" id="chipMyth">0</b></span>
          <span class="chip opt">Wien-Fäden <b class="mono" id="chipWien">0</b></span>
          <span class="chip opt"><b class="mono" id="chipKm">0</b> km</span>
        </div>
      </div>
      <div class="hud" id="side">
        <div class="panel"><h4>Smartphone als Controller</h4>
          <div id="qrBox"><div id="qr" aria-label="QR-Code zum Controller"></div><p>Mit der Handy-Kamera scannen<br>oder Code eingeben:<br><b id="codeTxt">······</b></p></div></div>
        <div class="panel" id="tonPanel"><h4>Kamera</h4>
          <div class="seg" style="--n:3" data-ks="kamera">${KAMERA.map(([k, n]) => `<button data-v="${k}" title="${k === "nord" ? "Norden oben" : k === "fahrt" ? "Blick in Fahrtrichtung" : "selbst drehen"}">${n}</button>`).join("")}</div>
          <div id="musikBox" hidden><h4>Musik</h4><div class="seg" style="--n:2" data-ks="musik"><button data-v="aus">aus</button><button data-v="an">an</button></div><p class="note" id="musikInfo"></p></div>
          <div id="vlBox" hidden><h4>Vorlesen</h4><div class="seg vl" data-ks="vorlesen">${VORLESEN.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join("")}</div><p class="note" id="vlInfo"></p></div>
        </div>
        <div class="panel"><h4>Tastatur</h4><div class="kbd"><kbd>←</kbd> <kbd>→</kbd> Station · <kbd>⇧</kbd>+Pfeil Tag<br><kbd>Leer</kbd> Fahren / Anhalten<br><kbd>↑</kbd> <kbd>↓</kbd> Tiefe · <kbd>R</kbd> Rolle · <kbd>F</kbd> Vollbild<br><kbd>K</kbd> Kamera · <kbd>M</kbd> Musik · <kbd>V</kbd> Vorlesen</div></div>
      </div>
      <aside class="hud" id="card" aria-live="polite"></aside>
      <div class="hud" id="rail"><div id="railRow" role="group" aria-label="Reisetage"></div>
        <div id="railMeta"><span><b id="metaDay">Tag 1</b> · <span id="metaDate"></span> · <span id="metaMode"></span></span><span class="legend" id="legend"></span></div></div>
      <div id="roles"><div class="rolesIn"><h2>Wie willst du reisen?</h2>
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
      document.getElementById("rolesLead").after(b); }
    // Rollen ohne passende Inhalte ausblenden (z. B. keine Wien-Fäden)
    if (!DAYS.some((d) => (d.wien_faden || []).length)) delete ROLLEN.wien;

    const S = { rolle:null, idx:0, playing:false, tempo:2, breite:2, tiefe:1, thema:null, seen:new Set(), mythen:new Set(), wien:new Set(),
      kamera: KAMERA.some((k) => k[0] === merk.get("kamera")) ? merk.get("kamera") : "frei",
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
    DAYS.forEach((d) => { const b = document.createElement("button"); b.className = "tick" + (d.status === "fehlt" ? " gap" : ""); b.style.background = colOf(d);
      b.title = "Tag " + d.tag + " · " + (d.titel || "noch ohne Eintrag"); b.setAttribute("aria-label", b.title); b.onclick = () => gotoDay(d.tag); row.appendChild(b); });
    const used = [...new Set(DAYS.flatMap((d) => d.land || []))].filter((c) => COUNTRY[c]);
    document.getElementById("legend").innerHTML = used.map((c) => `<span><i style="background:${COUNTRY[c].c}"></i>${COUNTRY[c].n}</span>`).join("") + '<span><i style="background:repeating-linear-gradient(135deg,#667 0 2px,transparent 2px 4px)"></i>ohne Eintrag</span>';

    // Rollen
    const rg = document.getElementById("roleGrid");
    Object.entries(ROLLEN).forEach(([k, r]) => { const b = document.createElement("button"); b.className = "role"; b.innerHTML = `<span class="k">${r.k}</span><span class="n">${r.n}</span><span class="d">${r.d}</span>`; b.onclick = () => setRole(k); rg.appendChild(b); });
    document.getElementById("chipRoleBtn").onclick = () => { document.getElementById("roles").hidden = !document.getElementById("roles").hidden; };
    // Direkt zu einem Tag springen: /atlas/<reise>/?tag=7 (z. B. aus der Reise-Statistik)
    { const t0 = +new URLSearchParams(location.search).get("tag");
      if (t0 && dayOf(t0)) { Object.assign(S, { rolle: "entdecker", tempo: 1, breite: 3, tiefe: 2, thema: null }); S.idx = Math.max(0, track().findIndex((s) => s.day >= t0)); document.getElementById("roles").hidden = true; } }
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
      const fragen = async () => { const f = inp.value.trim(); if (f.length < 3) return; an.hidden = false; an.innerHTML = "<p class='note'>Claude liest im Tagebuch nach …</p>";
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
    let lbIdx = -1, lbStartDay = null;
    const preload = (k) => { const x = ALLF[k]; if (x) { const im = new Image(); im.src = x.f.url; } };
    function showLb(k) {
      if (!ALLF.length) return; k = (k + ALLF.length) % ALLF.length; lbIdx = k; const x = ALLF[k];
      const img = document.getElementById("lbImg"); img.src = x.f.url; img.alt = x.f.text || "";
      document.getElementById("lbCap").innerHTML = `<span>Tag ${x.day} · ${x.i + 1}/${x.n}${x.f.zeit ? " · " + esc(x.f.zeit) : ""}</span>${esc(x.f.text)}`;
      lb.hidden = false; preload(k + 1); preload(k - 1); broadcast();
    }
    const openPhoto = (f) => { lbStartDay = (go.last || {}).day; const k = ALLF.findIndex((x) => x.f.url === f.url); showLb(k < 0 ? 0 : k); };
    const lbStep = (n) => showLb(lbIdx + n);
    function closeLb() { if (lb.hidden) return; lb.hidden = true; const x = ALLF[lbIdx]; lbIdx = -1;
      if (x && x.day !== lbStartDay) gotoDay(x.day); else broadcast(); }
    document.getElementById("lbClose").onclick = closeLb;
    document.getElementById("lbPrev").onclick = (e) => { e.stopPropagation(); lbStep(-1); };
    document.getElementById("lbNext").onclick = (e) => { e.stopPropagation(); lbStep(1); };
    let swX = null;
    lb.addEventListener("pointerdown", (e) => { swX = e.clientX; });
    lb.addEventListener("pointerup", (e) => { if (swX == null) return; const dx = e.clientX - swX; swX = null; if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1); });
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
          if (Math.abs(d) < 0.02) { musik.volume = ziel; clearInterval(fadeT); if (ziel === 0) musik.pause(); return; }
          musik.volume = Math.max(0, Math.min(1, v + Math.sign(d) * 0.02)); }, 40);
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
        clearInterval(fadeT); const t = setInterval(() => { musik.volume = Math.max(0, musik.volume - 0.03);
          if (musik.volume <= 0.01) { clearInterval(t); laden(); musik.volume = 0; spiele(musik); blende(); } }, 40);
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
      if (g.dataset.ks === "kamera") setKamera(b.dataset.v); else if (g.dataset.ks === "musik") ton.setMusik(b.dataset.v === "an"); else if (g.dataset.ks === "vorlesen") ton.setVorlesen(b.dataset.v); }));

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
    let van, fotoMarkers = [];
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

      ST.forEach((s, k) => { const e = document.createElement("div"); e.className = "pin" + (s.art === "uebernachtung" ? " night" : ""); e.title = "Tag " + s.day + " · " + s.name;
        e.onclick = () => { let t = track(); let i = t.indexOf(s); if (i < 0) { S.breite = 3; S.thema = null; t = track(); i = t.indexOf(s); } S.idx = Math.max(0, i); go(true); };
        pinEls[k] = e; new maplibregl.Marker({ element: e }).setLngLat([s.lon, s.lat]).addTo(map); });
      const ve = document.createElement("div"); ve.className = "van";
      van = new maplibregl.Marker({ element: ve, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([ST[0].lon, ST[0].lat]).addTo(map);
      setzeFahrzeug(dayOf(ST[0].day));
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
      map.getSource("done").setData(fc(feats));
      const vis = new Set(track()); ST.forEach((s, k) => pinEls[k] && pinEls[k].classList.toggle("dim", !vis.has(s)));
    }

    // ---------- Bewegung ----------
    let anim = null, timer = null;
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
    function animateAlong(path, ms, done, ziel) {
      stopAnim();
      if (reduced || path.length < 2 || ms < 50) { done(); return; }
      const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.sqrt(d2(path[k], path[k - 1])));
      const L = cum[cum.length - 1] || 1; const t0 = performance.now();
      const punktBei = (t) => { let k = 1; while (k < cum.length - 1 && cum[k] < t) k++; const a = path[k - 1], b = path[k], sg = (cum[k] - cum[k - 1]) || 1, u = Math.max(0, Math.min(1, (t - cum[k - 1]) / sg)); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
      const z0 = map.getZoom(), p0 = map.getPitch(); let kopf = map.getBearing(); let fzKopf = van.getRotation();
      const fahrt = S.kamera === "fahrt", zt = fahrt ? 11.6 : ziel.zoom, pt = fahrt ? 72 : ziel.pitch;
      const vor = Math.max(0.004, Math.min(0.03, L * 0.12)); // Blick voraus (~0,4–3 km)
      const step = (now) => {
        const f = Math.min(1, (now - t0) / ms); const e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; const target = e * L;
        const pos = punktBei(target); const g = Math.min(1, f / 0.2);
        const cam = { center: pos, zoom: z0 + (zt - z0) * g, pitch: p0 + (pt - p0) * g };
        const voraus = brg(pos, punktBei(Math.min(L, target + vor)));
        fzKopf = mischWinkel(fzKopf, voraus, 0.25); van.setRotation(fzKopf);
        if (fahrt) { kopf = mischWinkel(kopf, voraus, 0.12); cam.bearing = kopf; }
        else if (S.kamera === "nord") cam.bearing = 0;
        van.setLngLat(pos); map.jumpTo(cam);
        if (f < 1) anim = requestAnimationFrame(step); else { anim = null; done(); }
      };
      anim = requestAnimationFrame(step);
    }
    function go(jump) {
      const tr = track(); const s = tr[S.idx]; if (!s) { render(); return; }
      const prev = go.last; go.last = s;
      S.seen.add(s.day);
      const d = dayOf(s.day);
      if (S.tiefe >= 2) { (d.mythen || []).forEach((m, k) => S.mythen.add(d.tag + "-" + k)); (d.wien_faden || []).forEach((m, k) => S.wien.add(d.tag + "-" + k)); }
      if (!van) { render(); return; } // Karte lädt noch
      const zoom = S.tiefe >= 2 ? 10.2 : 8.4, pitch = narrow ? 45 : (S.tiefe >= 2 ? 68 : 58);
      const finish = () => { van.setLngLat([s.lon, s.lat]); setzeFahrzeug(d); { const r = richtungAn(d, s.ri); if (r != null) van.setRotation(r); } drawDone(); map.easeTo({ center: [s.lon, s.lat], zoom, pitch: S.kamera === "fahrt" && !narrow ? 70 : pitch, bearing: kameraZiel(s), duration: reduced ? 0 : 900 }); showFotos(d); render(); ton.ankunft(d); afterArrive(); };
      // fahren entlang der Straße, wenn möglich
      if (!jump && prev && d.line && prev.day === s.day && prev.ri != null && s.ri != null && s.ri > prev.ri) {
        const path = d.line.slice(prev.ri, s.ri + 1);
        animateAlong(path, [0, 5200, 3200, 1700][S.tempo], finish, { zoom: Math.min(zoom, 9.2), pitch });
      } else if (!jump && prev && d.line && s.day === prev.day + 1 && s.ri != null && dayOf(prev.day).line && prev.ri != null) {
        const pl = dayOf(prev.day).line.slice(prev.ri); const path = pl.concat(d.line.slice(0, s.ri + 1));
        animateAlong(path, [0, 7000, 4200, 2200][S.tempo], finish, { zoom: 8.6, pitch });
      } else {
        stopAnim(); map.flyTo({ center: [s.lon, s.lat], zoom, pitch, bearing: kameraZiel(s), duration: reduced ? 0 : [0, 2600, 1800, 1000][S.tempo], essential: true });
        finish();
      }
      render();
    }
    function afterArrive() { if (!S.playing) return; clearTimeout(timer); if (ton.liest()) { ton.danach(afterArrive); return; } const tr = track();
      if (S.idx >= tr.length - 1) { setPlay(false); return; }
      timer = setTimeout(() => { S.idx++; go(false); }, [0, 4200, 2200, 700][S.tempo] + (S.tiefe >= 2 ? 1500 : 0)); }
    function setPlay(p) { S.playing = p; clearTimeout(timer); if (p && !anim) afterArrive(); render(); }
    function step(n) { stopAnim(); clearTimeout(timer); const tr = track(); S.idx = Math.min(tr.length - 1, Math.max(0, S.idx + n)); go(n < 0); }
    function gotoDay(t) { stopAnim(); let k = track().findIndex((s) => s.day >= t); if (k < 0) { S.thema = null; S.breite = 3; k = track().findIndex((s) => s.day >= t); } S.idx = Math.max(0, k); go(true); }
    function dayStep(n) { const tr = track(); const cur = (tr[S.idx] || {}).day || 1; let tgt = cur + n;
      while (tgt >= 1 && tgt <= DAYS.length && !tr.some((s) => s.day === tgt)) tgt += n;
      if (tgt >= 1 && tgt <= DAYS.length) gotoDay(tgt); }
    function setRole(k) { const r = ROLLEN[k]; if (!r) return; S.rolle = k; Object.assign(S, { tempo: r.s.tempo, breite: r.s.breite, tiefe: r.s.tiefe, thema: r.s.thema });
      document.getElementById("roles").hidden = true; const cur = (go.last || ST[0]).day; S.idx = Math.max(0, track().findIndex((s) => s.day >= cur)); go(true); setPlay(r.s.play); }

    function showFotos(d) { fotoMarkers.forEach((m) => m.remove()); fotoMarkers = [];
      if (S.tiefe < 2) return;
      (d.fotos || []).forEach((f) => { if (typeof f.lat !== "number") return; const e = document.createElement("button"); e.className = "fpin"; e.style.backgroundImage = `url("${f.url}")`; e.setAttribute("aria-label", "Foto: " + f.text); e.onclick = () => openPhoto(f);
        fotoMarkers.push(new maplibregl.Marker({ element: e }).setLngLat([f.lon, f.lat]).addTo(map)); }); }

    // ---------- Anzeige ----------
    function render() {
      const tr = track(); const s = tr[S.idx]; const d = s ? dayOf(s.day) : DAYS[0];
      document.getElementById("chipRole").textContent = S.rolle ? ROLLEN[S.rolle].n : "–";
      document.querySelectorAll("#tonPanel .seg").forEach((g) => [...g.children].forEach((b) => b.classList.toggle("on", b.dataset.v === (g.dataset.ks === "musik" ? (S.musik ? "an" : "aus") : S[g.dataset.ks]))));
      document.getElementById("chipMyth").textContent = S.mythen.size + "/" + DAYS.reduce((a, x) => a + (x.mythen || []).length, 0);
      document.getElementById("chipWien").textContent = S.wien.size + "/" + DAYS.reduce((a, x) => a + (x.wien_faden || []).length, 0);
      const kmSoFar = DAYS.filter((x) => x.tag < d.tag).reduce((a, x) => a + ((x.route && x.route.km) || 0), 0);
      document.getElementById("chipKm").textContent = Math.round(kmSoFar).toLocaleString("de-AT") + " / " + Math.round(kmTotal).toLocaleString("de-AT");
      [...row.children].forEach((b, k) => { const dd = DAYS[k]; b.classList.toggle("cur", dd.tag === d.tag); b.classList.toggle("seen", S.seen.has(dd.tag)); b.classList.toggle("dim", !dayMatches(dd)); });
      ST.forEach((x, k) => pinEls[k] && pinEls[k].classList.toggle("cur", x === s));
      document.getElementById("metaDay").textContent = "Tag " + d.tag;
      document.getElementById("metaDate").textContent = fmtDate(d.datum);
      document.getElementById("metaMode").textContent = `${S.playing ? "▶ fährt" : "❚❚ steht"} · Tempo ${["", "langsam", "mittel", "schnell"][S.tempo]} · Breite ${["", "Highlights", "Stationen", "alles"][S.breite]}${S.thema ? " · Thema " + themaName(S.thema) : ""}`;

      let h = `<span class="day">Tag ${d.tag} · ${esc(fmtDate(d.datum))} · ${esc((d.land || []).map((c) => (COUNTRY[c] || {}).n || c).join(" → "))}</span><h2>${esc((s && s.name) || d.titel || "Ohne Eintrag")}</h2>`;
      if (d.titel && s) h += `<span class="stn">${esc(d.titel)}${s.notiz ? " · " + esc(s.notiz) : ""}${d.route && d.route.km ? ` · ${String(d.route.km).replace(".", ",")} km` : ""}</span>`;
      { const w = WETTER[d.tag], so = d.sonne; const bits = [];
        if (w && w.max != null) bits.push(`${wmoIcon(w.code)} ${Math.round(w.max)}° / ${Math.round(w.min)}°${w.regen >= 1 ? ` · ${String(Math.round(w.regen * 10) / 10).replace(".", ",")} mm` : ""}`);
        if (so) bits.push(`↑ ${so.auf} · ↓ ${so.unter}`);
        if (bits.length) h += `<span class="wx" title="Wetter am Übernachtungsort (Open-Meteo) · Sonnenauf- und -untergang">${bits.join(" · ")}</span>`; }
      h += `<div class="depth" aria-label="Tiefe ${S.tiefe} von 3">Tiefe ${[0, 1, 2, 3].map((k) => `<i class="${k <= S.tiefe ? "on" : ""}"></i>`).join("")}</div>`;
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
        if ((d.wien_faden || []).length) h += `<div class="sect"><h3>Faden nach Wien</h3>${d.wien_faden.map((w) => `<p style="font-size:14px"><b>${esc(w.person_oder_thema)}</b> – ${esc(w.bezug)}</p>`).join("")}</div>`;
        const all = d.stationen || []; if (all.length > 1) h += `<div class="sect"><h3>Alle Stationen</h3><p class="note">${all.map((x) => esc(x.name)).join(" → ")}</p></div>`;
        if (d.seite) h += `<a class="more" href="${esc(d.seite)}">Ganzes Tagebuch von Tag ${d.tag} lesen →</a>`;
      }
      if (d.status === "fehlt") h += `<p class="note">Für diesen Tag gibt es noch keinen Eintrag.</p>`;
      const card = document.getElementById("card"); card.innerHTML = h;
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
      else if (e.key === "ArrowUp") { S.tiefe = Math.min(3, S.tiefe + 1); go(true); e.preventDefault(); }
      else if (e.key === "ArrowDown") { S.tiefe = Math.max(0, S.tiefe - 1); go(true); e.preventDefault(); }
      else if (e.key === "r" || e.key === "R") document.getElementById("chipRoleBtn").click();
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
      if ([1, 2, 3].includes(m.tempo)) S.tempo = m.tempo;
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
        <div class="sl"><label>Tempo</label><div class="seg" style="--n:3" data-k="tempo"><button data-v="1">langsam</button><button data-v="2">mittel</button><button data-v="3">schnell</button></div></div>
        <div class="sl"><label>Breite</label><div class="seg" style="--n:3" data-k="breite"><button data-v="1">Highlights</button><button data-v="2">Stationen</button><button data-v="3">alles</button></div></div>
        <div class="sl"><label>Tiefe</label><div class="seg" style="--n:4" data-k="tiefe"><button data-v="0">Ort</button><button data-v="1">Satz</button><button data-v="2">Teaser</button><button data-v="3">alles</button></div></div>
      </div>
      <div class="secTitle">Thema</div><div class="pills" id="cThemen"></div>
      <div class="secTitle">Rolle</div><div class="pills" id="cRollen"></div>
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
