/* Reise-Atlas – Bildschirm + iPhone-Controller.
   Kopplung: der Bildschirm öffnet einen PeerJS-Kanal „rcatlas-<code>“, das iPhone verbindet sich über
   /atlas/#c-<code> (QR-Code). Keine Anmeldung, kein eigener Server. */
(function () {
  "use strict";
  const APP = document.getElementById("app");
  const REISE = APP.dataset.reise;
  const TITLE = APP.dataset.title;
  const PEER_PREFIX = "rcatlas-";

  const COUNTRY = {AT:{n:"Österreich",c:"#c9b38a"},SI:{n:"Slowenien",c:"#b9c08a"},HR:{n:"Kroatien",c:"#7fb7c9"},ME:{n:"Montenegro",c:"#a68fc2"},AL:{n:"Albanien",c:"#d86b5a"},GR:{n:"Griechenland",c:"#6fa0d8"},MK:{n:"Nordmazedonien",c:"#e0b13a"},RS:{n:"Serbien",c:"#9aa65a"}};
  const THEMEN = [["geschichte","Geschichte"],["habsburg","Wien-Faden"],["mythencheck","Legenden"],["kulinarik","Essen"],["kloster","Klöster"],["burg","Burgen"],["natur","Natur"],["strand","Strand"],["grenze","Grenzen"],["panne","Pannen"],["eisenbahn","Eisenbahn"],["faehre","Fähren"]];
  const ROLLEN = {
    zuschauer:{n:"Zuschauer",k:"im Flug",d:"Die ganze Route am Stück. Nur Orte und ein Satz pro Tag.",s:{tempo:3,breite:1,tiefe:1,thema:null,play:true}},
    entdecker:{n:"Entdecker",k:"frei",d:"Selbst fahren, anhalten, jede Station öffnen.",s:{tempo:1,breite:3,tiefe:2,thema:null,play:false}},
    zeitreisender:{n:"Zeitreisender",k:"Geschichte",d:"Durch die Schichten: Antike, Osmanen, Habsburg.",s:{tempo:1,breite:2,tiefe:3,thema:"geschichte",play:false}},
    geniesser:{n:"Genießer",k:"Kulinarik",d:"Lokale, Gerichte und woher sie kommen.",s:{tempo:2,breite:3,tiefe:2,thema:"kulinarik",play:false}},
    abenteurer:{n:"Abenteurer",k:"Pannen & Grenzen",d:"Offroad, Reifen, Staus – die ehrliche Seite.",s:{tempo:2,breite:3,tiefe:2,thema:"panne",play:false}},
    wien:{n:"Wien-Spurensucher",k:"Quest",d:"Folge den Fäden, die von hier nach Wien führen.",s:{tempo:2,breite:2,tiefe:3,thema:"habsburg",play:false}}
  };
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
      <h2>Reise-Atlas</h2><p>Am besten am Mac oder Fernseher ansehen und mit dem iPhone steuern. Am Bildschirm steht ein QR-Code und ein Code aus sechs Zeichen.</p>
      <label for="codeIn" class="note">Code vom Bildschirm</label>
      <input id="codeIn" inputmode="text" autocomplete="off" autocapitalize="none" maxlength="6" placeholder="abc123">
      <button class="big primary" id="asCtl">Verbinden<small>iPhone als Controller</small></button>
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
        <a class="brand" href="/reise/${REISE}/"><span class="eyebrow">Renate &amp; Chris · Reise-Atlas</span><h1>${esc(TITLE)}</h1></a>
        <div class="chips">
          <span class="chip"><i class="dot" id="linkDot"></i><b id="linkTxt">Kein iPhone verbunden</b></span>
          <button class="chip" id="chipRoleBtn" title="Rolle wechseln (R)">Rolle <b id="chipRole">–</b></button>
          <span class="chip opt">Legenden <b class="mono" id="chipMyth">0</b></span>
          <span class="chip opt">Wien-Fäden <b class="mono" id="chipWien">0</b></span>
          <span class="chip opt"><b class="mono" id="chipKm">0</b> km</span>
        </div>
      </div>
      <div class="hud" id="side">
        <div class="panel"><h4>iPhone als Controller</h4>
          <div id="qrBox"><div id="qr" aria-label="QR-Code zum Controller"></div><p>Mit der iPhone-Kamera scannen<br>oder Code eingeben:<br><b id="codeTxt">······</b></p></div></div>
        <div class="panel"><h4>Tastatur</h4><div class="kbd"><kbd>←</kbd> <kbd>→</kbd> Station · <kbd>⇧</kbd>+Pfeil Tag<br><kbd>Leer</kbd> Fahren / Anhalten<br><kbd>↑</kbd> <kbd>↓</kbd> Tiefe · <kbd>R</kbd> Rolle · <kbd>F</kbd> Vollbild</div></div>
      </div>
      <aside class="hud" id="card" aria-live="polite"></aside>
      <div class="hud" id="rail"><div id="railRow" role="group" aria-label="Reisetage"></div>
        <div id="railMeta"><span><b id="metaDay">Tag 1</b> · <span id="metaDate"></span> · <span id="metaMode"></span></span><span class="legend" id="legend"></span></div></div>
      <div id="roles"><div class="rolesIn"><h2>Wie willst du reisen?</h2>
        <p>31 Tage, sieben Länder, ein Campervan. Wähle, wie viel du sehen willst – mit Maus, Tastatur oder dem iPhone. Jederzeit wechselbar.</p>
        <div class="roleGrid" id="roleGrid"></div></div></div>
      <div id="lightbox" hidden><button class="big" id="lbClose">Schließen</button><figure><img id="lbImg" alt=""><figcaption id="lbCap"></figcaption></figure></div>
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

    const S = { rolle:null, idx:0, playing:false, tempo:2, breite:2, tiefe:1, thema:null, seen:new Set(), mythen:new Set(), wien:new Set() };
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

    // Lightbox
    const lb = document.getElementById("lightbox");
    const openPhoto = (f) => { document.getElementById("lbImg").src = f.url; document.getElementById("lbImg").alt = f.text; document.getElementById("lbCap").innerHTML = `${f.zeit ? `<span>${esc(f.zeit)}</span>` : ""}${esc(f.text)}`; lb.hidden = false; };
    document.getElementById("lbClose").onclick = () => { lb.hidden = true; };
    lb.addEventListener("click", (e) => { if (e.target === lb) lb.hidden = true; });

    setTimeout(() => { if (!van) render(); }, 0);
    // ---------- Karte ----------
    const map = new maplibregl.Map({
      container: "map", style: "https://tiles.openfreemap.org/styles/liberty",
      center: [16.5, 43.3], zoom: narrow ? 5.2 : 5.6, pitch: narrow ? 35 : 55, bearing: -10, maxPitch: 80, attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Höhen: <a href="https://registry.opendata.aws/terrain-tiles" target="_blank" rel="noopener">Terrain Tiles (AWS Open Data)</a> · Routen: <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a> (Näherung)' }), "bottom-left");
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

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
      const ve = document.createElement("div"); ve.className = "van"; ve.innerHTML = '<svg viewBox="0 0 24 24" fill="#0a1b23" aria-hidden="true"><path d="M3 7h11l4 4h3v5h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3z"/></svg>';
      van = new maplibregl.Marker({ element: ve }).setLngLat([ST[0].lon, ST[0].lat]).addTo(map);
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
    function animateAlong(path, ms, done) {
      stopAnim();
      if (reduced || path.length < 2 || ms < 50) { done(); return; }
      const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.sqrt(d2(path[k], path[k - 1])));
      const L = cum[cum.length - 1] || 1; const t0 = performance.now();
      const step = (now) => {
        const f = Math.min(1, (now - t0) / ms); const e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; const target = e * L;
        let k = 1; while (k < cum.length - 1 && cum[k] < target) k++;
        const a = path[k - 1], b = path[k], seg = (cum[k] - cum[k - 1]) || 1, u = (target - cum[k - 1]) / seg;
        const pos = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        van.setLngLat(pos); map.jumpTo({ center: pos });
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
      const finish = () => { van.setLngLat([s.lon, s.lat]); drawDone(); map.easeTo({ center: [s.lon, s.lat], zoom, pitch, duration: reduced ? 0 : 900 }); showFotos(d); render(); afterArrive(); };
      // fahren entlang der Straße, wenn möglich
      if (!jump && prev && d.line && prev.day === s.day && prev.ri != null && s.ri != null && s.ri > prev.ri) {
        const path = d.line.slice(prev.ri, s.ri + 1);
        map.easeTo({ zoom: Math.min(zoom, 9.2), pitch, duration: reduced ? 0 : 500 });
        animateAlong(path, [0, 5200, 3200, 1700][S.tempo], finish);
      } else if (!jump && prev && d.line && s.day === prev.day + 1 && s.ri != null && dayOf(prev.day).line && prev.ri != null) {
        const pl = dayOf(prev.day).line.slice(prev.ri); const path = pl.concat(d.line.slice(0, s.ri + 1));
        map.easeTo({ zoom: 8.6, pitch, duration: reduced ? 0 : 600 });
        animateAlong(path, [0, 7000, 4200, 2200][S.tempo], finish);
      } else {
        stopAnim(); map.flyTo({ center: [s.lon, s.lat], zoom, pitch, duration: reduced ? 0 : [0, 2600, 1800, 1000][S.tempo], essential: true });
        finish();
      }
      render();
    }
    function afterArrive() { if (!S.playing) return; clearTimeout(timer); const tr = track();
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
      h += `<div class="depth" aria-label="Tiefe ${S.tiefe} von 3">Tiefe ${[0, 1, 2, 3].map((k) => `<i class="${k <= S.tiefe ? "on" : ""}"></i>`).join("")}</div>`;
      if (S.tiefe >= 1 && d.satz) h += `<p class="lead">${esc(d.satz)}</p>`;
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
      broadcast();
    }

    // ---------- Tastatur ----------
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea")) return;
      if (e.key === "Escape") { lb.hidden = true; return; }
      if (e.key === "ArrowRight") { e.shiftKey ? dayStep(1) : step(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { e.shiftKey ? dayStep(-1) : step(-1); e.preventDefault(); }
      else if (e.key === " ") { setPlay(!S.playing); e.preventDefault(); }
      else if (e.key === "ArrowUp") { S.tiefe = Math.min(3, S.tiefe + 1); go(true); e.preventDefault(); }
      else if (e.key === "ArrowDown") { S.tiefe = Math.max(0, S.tiefe - 1); go(true); e.preventDefault(); }
      else if (e.key === "r" || e.key === "R") document.getElementById("chipRoleBtn").click();
      else if (e.key === "f" || e.key === "F") { if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
    });

    // ---------- Kopplung (PeerJS) ----------
    const conns = new Set();
    function stateMsg() { const s = track()[S.idx]; const d = s ? dayOf(s.day) : DAYS[0];
      return { t: "state", tag: d.tag, datum: d.datum, ort: (s && s.name) || "", satz: d.satz || "", playing: S.playing, tempo: S.tempo, breite: S.breite, tiefe: S.tiefe, thema: S.thema, rolle: S.rolle }; }
    function broadcast() { const m = stateMsg(); conns.forEach((c) => { try { c.open && c.send(m); } catch (e) {} }); }
    function apply(m) {
      if (!m || typeof m !== "object") return;
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
      if (m.orbit && typeof m.orbit.b === "number") map.easeTo({ bearing: map.getBearing() + Math.max(-40, Math.min(40, m.orbit.b)), pitch: Math.max(0, Math.min(80, map.getPitch() + Math.max(-20, Math.min(20, +m.orbit.p || 0)))), duration: 250 });
      if (m.zoom === 1 || m.zoom === -1) map.easeTo({ zoom: map.getZoom() + m.zoom, duration: 300 });
      render();
    }
    function linkUi() { const n = [...conns].filter((c) => c.open).length; document.getElementById("linkDot").classList.toggle("on", n > 0);
      document.getElementById("linkTxt").textContent = n ? (n === 1 ? "iPhone verbunden" : n + " Controller verbunden") : "Kein iPhone verbunden"; }
    function newCode() { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(6)); r.forEach((x) => s += a[x % a.length]); return s; }
    let code; try { code = sessionStorage.getItem("atlasCode"); } catch (e) {}
    if (!code || !/^[a-z0-9]{6}$/.test(code)) code = newCode();
    function openPeer(tries) {
      if (!window.Peer) { document.getElementById("linkTxt").textContent = "Controller nicht verfügbar"; return; }
      const peer = new Peer(PEER_PREFIX + code, { debug: 0 });
      peer.on("open", () => { try { sessionStorage.setItem("atlasCode", code); } catch (e) {}
        const url = `${location.origin}/atlas/#c-${code}`;
        document.getElementById("codeTxt").textContent = code;
        try { const q = qrcode(0, "M"); q.addData(url); q.make(); document.getElementById("qr").innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) {} });
      peer.on("connection", (c) => { conns.add(c); c.on("open", () => { linkUi(); c.send(stateMsg()); }); c.on("data", apply); c.on("close", () => { conns.delete(c); linkUi(); }); c.on("error", () => { conns.delete(c); linkUi(); }); });
      peer.on("error", (e) => { if (e && e.type === "unavailable-id" && tries < 3) { peer.destroy(); code = newCode(); openPeer(tries + 1); } });
      peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });
    }
    openPeer(0);
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
      <div class="secTitle">Regler</div>
      <div class="sliders">
        <div class="sl"><label>Tempo</label><div class="seg" style="--n:3" data-k="tempo"><button data-v="1">langsam</button><button data-v="2">mittel</button><button data-v="3">schnell</button></div></div>
        <div class="sl"><label>Breite</label><div class="seg" style="--n:3" data-k="breite"><button data-v="1">Highlights</button><button data-v="2">Stationen</button><button data-v="3">alles</button></div></div>
        <div class="sl"><label>Tiefe</label><div class="seg" style="--n:4" data-k="tiefe"><button data-v="0">Ort</button><button data-v="1">Satz</button><button data-v="2">Teaser</button><button data-v="3">alles</button></div></div>
      </div>
      <div class="secTitle">Thema</div><div class="pills" id="cThemen"></div>
      <div class="secTitle">Rolle</div><div class="pills" id="cRollen"></div>
      <div class="secTitle">Kamera</div>
      <div id="orbit">Wischen: links/rechts drehen, hoch/runter neigen</div>
      <div class="pad" style="grid-template-columns:1fr 1fr"><button class="big" id="bZoomOut">−<small>weiter weg</small></button><button class="big" id="bZoomIn">+<small>näher</small></button></div>
    </div>`);
    const $ = (id) => document.getElementById(id);
    let conn = null, scr = null;
    const tp = $("cThemen"); tp.insertAdjacentHTML("beforeend", `<button data-v="">alle</button>` + THEMEN.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join(""));
    const rp = $("cRollen"); rp.innerHTML = Object.entries(ROLLEN).map(([k, r]) => `<button data-v="${k}">${r.n}</button>`).join("");
    const send = (m) => { if (!conn || !conn.open) { $("ctlStatus").textContent = "nicht verbunden"; return; } conn.send(m); try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
    $("bPrev").onclick = () => send({ step: -1 }); $("bNext").onclick = () => send({ step: 1 });
    $("bDayPrev").onclick = () => send({ day: -1 }); $("bDayNext").onclick = () => send({ day: 1 });
    $("bPlay").onclick = () => send({ playing: !(scr && scr.playing) });
    $("bMore").onclick = () => send({ tiefe: Math.min(3, ((scr && scr.tiefe) || 0) + 1) });
    $("bZoomIn").onclick = () => send({ zoom: 1 }); $("bZoomOut").onclick = () => send({ zoom: -1 });
    document.querySelectorAll("#ctl .seg").forEach((g) => g.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send({ [g.dataset.k]: +b.dataset.v }); }));
    tp.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send({ thema: b.dataset.v || null }); });
    rp.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) send({ rolle: b.dataset.v }); });
    const pad = $("orbit"); let sx = 0, sy = 0;
    pad.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; pad.setPointerCapture(e.pointerId); });
    pad.addEventListener("pointermove", (e) => { if (!pad.hasPointerCapture(e.pointerId)) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) < 14) return; sx = e.clientX; sy = e.clientY; send({ orbit: { b: dx * 0.6, p: -dy * 0.4 } }); });
    function show(p) { scr = p;
      $("cDay").textContent = "Tag " + p.tag + " · " + fmtDate(p.datum); $("cOrt").textContent = p.ort || ""; $("cSatz").textContent = p.tiefe >= 1 ? (p.satz || "") : "";
      $("bPlay").firstChild.textContent = p.playing ? "Anhalten" : "Fahren";
      document.querySelectorAll("#ctl .seg").forEach((g) => [...g.children].forEach((b) => b.classList.toggle("on", +b.dataset.v === p[g.dataset.k])));
      [...tp.children].forEach((b) => b.classList.toggle("on", (b.dataset.v || null) === (p.thema || null)));
      [...rp.children].forEach((b) => b.classList.toggle("on", b.dataset.v === p.rolle)); }
    if (!window.Peer) { $("ctlStatus").textContent = "Verbindung nicht möglich"; return; }
    const peer = new Peer({ debug: 0 });
    let tries = 0, pending = null;
    function retry(ms) { clearTimeout(pending); pending = setTimeout(connect, ms); }
    function connect() {
      if (conn) { try { conn.close(); } catch (e) {} }
      conn = peer.connect(PEER_PREFIX + code, { reliable: true });
      conn.on("open", () => { $("ctlStatus").textContent = "verbunden"; tries = 0; });
      conn.on("data", (m) => { if (m && m.t === "state") show(m); });
      conn.on("close", () => { $("ctlStatus").textContent = "getrennt – verbinde neu …"; retry(1500); });
    }
    peer.on("open", connect);
    peer.on("error", (e) => { if (e && e.type === "peer-unavailable") { $("ctlStatus").textContent = "Bildschirm nicht gefunden"; $("cSatz").textContent = "Ist der Atlas am Mac offen? Stimmt der Code " + code + "?"; if (++tries < 20) retry(3000); } });
  }
})();
