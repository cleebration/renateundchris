/* Reise-Atlas · Weltkugel – alle Reisen auf einem drehbaren Globus (MapLibre 5, Projektion „globe“).
   Daten: /atlas/data/welt.json (beim Bauen erzeugt). Karte: OpenFreeMap. */
(function () {
  "use strict";
  const ROOT = document.getElementById("welt");
  const V = ROOT.dataset.v || "";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n0 = (x) => Math.round(x).toLocaleString("de-AT");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Handy hochkant: Globus oben, Liste darunter scrollt · Handy quer: Globus links, Liste rechts · sonst Panel links über dem Globus
  const grob = matchMedia("(pointer: coarse)").matches; // iPad & Co.: dieselben Ansichten wie am iPhone
  const modus = () => (grob ? (innerWidth > innerHeight ? "quer" : "hoch") : innerHeight <= 500 && innerWidth > innerHeight ? "quer" : innerWidth < 760 ? "hoch" : "gross");
  const narrow = () => modus() !== "gross";
  const setzeModus = () => { document.body.dataset.modus = modus(); };
  setzeModus();

  ROOT.innerHTML = `<div id="topbar"><a class="tbBtn" href="/" aria-label="Startseite renateundchris.com">‹</a><div id="insel"><button class="tzChip" id="tbRund">▶ Rundflug</button><button id="tbKompass" aria-label="Globus nach Norden ausrichten"><span class="kn"><i></i><b></b></span></button></div><button class="tbBtn" id="tbLupe" aria-label="Suchen ein/aus" aria-pressed="false">🔎</button><button class="tbBtn" id="tbInfo" aria-label="Hilfe ein/aus" aria-pressed="false">i</button><a class="tbBtn" href="/atlas/statistik/" aria-label="Statistik">📊</a></div>
    <div id="tbSuche" hidden></div>
    <div id="map" aria-label="Weltkugel mit allen Reisen"></div>
    <aside id="panel">
      <header><a class="home" href="/">← Startseite renateundchris.com</a><span class="eyebrow">Renate &amp; Chris · Reise-Atlas</span><h1>Unsere Reisen</h1><p class="sum mono" id="sum"></p>
        <div class="acts"><button class="btn primary" id="tour">▶ Rundflug</button><a class="btn" href="/atlas/statistik/">📊 Statistik</a></div></header>
      <form class="frage" id="frageForm" role="search"><label for="such">🔎 Suchen oder ✨ fragen</label>
        <div class="frRow"><input id="such" type="search" placeholder="z. B. Meteora – oder: Wo war es am heißesten?" autocomplete="off"><button class="btn primary" type="submit">Fragen</button></div></form>
      <div id="antwort" hidden></div>
      <ol id="treffer" hidden aria-label="Suchergebnisse"></ol>
      <ol id="list" aria-label="Reisen"></ol>
      <p class="hint mono">Globus mit Maus oder Fingern drehen · ← → wählen · Enter öffnet</p>
    </aside>`;

  // Teaser im Fenster: hochkant am Handy, sonst quer
  function teaser(r) {
    const src = (innerHeight > innerWidth ? r.teaser.hoch || r.teaser.quer : r.teaser.quer || r.teaser.hoch);
    const box = document.createElement("div"); box.className = "tzBox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Teaser " + r.title);
    box.innerHTML = `<div class="tzIn"><video src="${esc(src)}" poster="${esc(r.cover)}" controls autoplay playsinline></video>
      <div class="tzBar"><a class="btn primary" href="/atlas/${esc(r.slug)}/">Ganze Reise erkunden →</a><a class="btn" href="${esc(src)}" download>Video speichern</a><button class="btn" data-x>Schließen</button></div></div>`;
    const zu = () => { box.remove(); removeEventListener("keydown", esc_); };
    const esc_ = (e) => { if (e.key === "Escape") zu(); };
    box.addEventListener("click", (e) => { if (e.target === box || e.target.hasAttribute("data-x")) zu(); });
    addEventListener("keydown", esc_); document.body.appendChild(box); box.querySelector("[data-x]").focus();
  }

  // Suche über alle Reisen (/atlas/data/suche.json, beim ersten Tippen geladen)
  let SUCHE = null;
  const such = document.getElementById("such"), tr = document.getElementById("treffer");
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  document.getElementById("frageForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = such.value.trim(); if (f.length < 3) return; tr.hidden = true;
    const an = document.getElementById("antwort"); an.hidden = false; an.innerHTML = "<p class='hint'>Claude liest im Tagebuch nach …</p>";
    try { const j = await fetch("/api/frage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ frage: f, reise: "" }) }).then((r) => r.json());
      an.innerHTML = j.fehler ? `<p class="hint">${esc(j.fehler)}</p>` : `<p>${esc(j.antwort)}</p>${(j.quellen || []).map((q) => `<a href="/atlas/${esc(q.reise)}/?tag=${q.tag}">→ ${esc(q.titelReise)} · Tag ${q.tag}</a>`).join("")}`;
    } catch (err) { an.innerHTML = "<p class='hint'>Die Frage konnte gerade nicht beantwortet werden.</p>"; }
  });
  such.addEventListener("input", async () => {
    const q = norm(such.value).trim();
    if (q.length < 2) { tr.hidden = true; document.getElementById("list").hidden = false; return; }
    if (!SUCHE) { try { SUCHE = await fetch("/atlas/data/suche.json?v=" + V).then((r) => r.json()); } catch (e) { SUCHE = []; } }
    const t = SUCHE.filter((x) => norm(x.titel + " " + x.text).includes(q)).slice(0, 15);
    tr.innerHTML = t.length ? t.map((x) => { const i = norm(x.text).indexOf(q); const aus = i >= 0 ? x.text.slice(Math.max(0, i - 30), i + 70) : x.titel;
      return `<li><a href="/atlas/${esc(x.reise)}/?tag=${x.tag}"><b>${esc(x.titelReise)} · Tag ${x.tag}</b><span>${esc(x.titel)}</span><small>…${esc(aus)}…</small></a></li>`; }).join("") : '<li class="err">Nichts gefunden.</li>';
    tr.hidden = false; document.getElementById("list").hidden = true;
  });

  fetch("/atlas/data/welt.json?v=" + V).then((r) => r.json()).then(start).catch(() => {
    document.getElementById("list").innerHTML = '<li class="err">Die Reisen konnten nicht geladen werden. <a href="/">Zur Startseite</a></li>';
  });

  function start(D) {
    const R = D.reisen;
    const laender = new Set(R.flatMap((r) => r.laender));
    document.getElementById("sum").textContent = `${R.length} ${R.length === 1 ? "Reise" : "Reisen"} · ${R.reduce((a, r) => a + r.tage, 0)} Tage · ${n0(R.reduce((a, r) => a + r.km, 0))} km · ${laender.size} Länder`;
    const list = document.getElementById("list");
    list.innerHTML = R.map((r, i) => `<li><a class="trip" href="/atlas/${esc(r.slug)}/" data-i="${i}" style="--acc:${esc(r.accent)}">
      <span class="th">${r.cover ? `<img src="${esc(r.cover)}" alt="" loading="lazy">` : ""}</span>
      <span class="tx"><span class="zt mono">${esc(r.zeitraum)}</span><b>${esc(r.title)}</b>
        <span class="kz mono">${r.tage} Tage · ${n0(r.km)} km · ${r.laender.length} ${r.laender.length === 1 ? "Land" : "Länder"}</span>
        <span class="go">Eintauchen →</span></span></a>${r.teaser ? `<button class="tz" data-t="${i}" aria-label="Teaser von ${esc(r.title)} ansehen">▶ Teaser</button>` : ""}</li>`).join("");
    list.addEventListener("click", (e) => { const b = e.target.closest(".tz"); if (!b) return; e.preventDefault(); teaser(R[+b.dataset.t]); });

    if (typeof maplibregl === "undefined") { document.getElementById("map").innerHTML = '<p class="nomap">Die Karte konnte nicht geladen werden.</p>'; return; }
    const map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/liberty", center: reduced ? [14, 30] : [-150, 22], zoom: narrow() ? 0.9 : 1.4,
      attributionControl: false, maxPitch: 60 });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Routen: OSRM (Näherung)" }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");

    let sel = -1, spin = !reduced, idleT = null, tourOn = false;
    const all = () => { const b = R.filter((r) => r.bbox).map((r) => r.bbox); return [[Math.min(...b.map((x) => x[0]), D.zuhause.lon), Math.min(...b.map((x) => x[1]), D.zuhause.lat)], [Math.max(...b.map((x) => x[2]), D.zuhause.lon), Math.max(...b.map((x) => x[3]), D.zuhause.lat)]]; };
    const pad = () => (modus() === "gross" ? { top: 80, bottom: 80, left: 440, right: 80 } : { top: 30, bottom: 30, left: 30, right: 30 });
    addEventListener("resize", () => { const alt = document.body.dataset.modus; setzeModus(); if (alt !== document.body.dataset.modus) setTimeout(() => map.resize(), 50); });

    map.on("style.load", () => {
      try { map.setProjection({ type: "globe" }); } catch (e) {}
      try { map.setSky({ "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] }); } catch (e) {}
    });
    map.on("load", () => {
      R.forEach((r, i) => {
        map.addSource("r" + i, { type: "geojson", data: { type: "Feature", properties: { i }, geometry: { type: "LineString", coordinates: r.linie } } });
        map.addLayer({ id: "glow" + i, type: "line", source: "r" + i, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": r.accent, "line-width": 10, "line-opacity": 0.25, "line-blur": 6 } });
        map.addLayer({ id: "line" + i, type: "line", source: "r" + i, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": r.accent, "line-width": 3.2 } });
        map.on("click", "line" + i, () => location.assign(`/atlas/${r.slug}/`));
        map.on("mouseenter", "line" + i, () => { map.getCanvas().style.cursor = "pointer"; waehle(i, false); });
        map.on("mouseleave", "line" + i, () => { map.getCanvas().style.cursor = ""; });
        // Fähnchen am Ende der Route (weitester Punkt vom Zuhause)
        const far = r.linie.reduce((b, p) => { const d = (p[0] - D.zuhause.lon) ** 2 + (p[1] - D.zuhause.lat) ** 2; return d > b.d ? { p, d } : b; }, { p: r.linie[0], d: -1 }).p;
        if (far) { const el = document.createElement("a"); el.className = "flag"; el.href = `/atlas/${r.slug}/`; el.style.setProperty("--acc", r.accent);
          el.innerHTML = `<span>${esc(r.title)}</span>`; el.onmouseenter = () => waehle(i, false); r.marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(far).addTo(map); }
      });
      const home = document.createElement("div"); home.className = "home"; home.title = "Zuhause: " + D.zuhause.name; home.innerHTML = `<i></i><span>${esc(D.zuhause.name)}</span>`;
      new maplibregl.Marker({ element: home }).setLngLat([D.zuhause.lon, D.zuhause.lat]).addTo(map);
      // beim Laden: die Erde dreht sich einmal herein (von Amerika nach Europa), dann Flug zu den Reisen
      if (!reduced) { map.easeTo({ center: [14, 38], duration: 3600, easing: (t) => 1 - Math.pow(1 - t, 3) });
        setTimeout(() => { if (sel < 0 && !tourOn) map.fitBounds(all(), { padding: pad(), duration: 2800, maxZoom: 5 }); }, 3700); }
      else map.fitBounds(all(), { padding: pad(), duration: 0, maxZoom: 5 });
      dreh();
    });

    // langsam drehen, solange niemand eingreift
    function dreh() {
      if (!spin || sel >= 0 || tourOn) return;
      if (map.getZoom() < 4.5 && !map.isMoving()) { const c = map.getCenter(); map.easeTo({ center: [c.lng + 6, c.lat], duration: 6000, easing: (t) => t }); }
      setTimeout(dreh, 6000);
    }
    const stopSpin = () => { spin = false; clearTimeout(idleT); idleT = setTimeout(() => { if (sel < 0 && !tourOn && !reduced) { spin = true; dreh(); } }, 12000); };
    ["mousedown", "touchstart", "wheel"].forEach((ev) => map.getCanvasContainer().addEventListener(ev, () => { stopSpin(); map.stop(); }, { passive: true }));

    function hervorheben(i) {
      R.forEach((r, k) => {
        if (!map.getLayer("line" + k)) return;
        const on = i < 0 || k === i;
        map.setPaintProperty("line" + k, "line-width", k === i ? 5 : 3.2);
        map.setPaintProperty("line" + k, "line-opacity", on ? 1 : 0.25);
        map.setPaintProperty("glow" + k, "line-opacity", k === i ? 0.5 : on ? 0.25 : 0.05);
        if (r.marker) r.marker.getElement().classList.toggle("on", k === i);
      });
      list.querySelectorAll(".trip").forEach((a) => a.classList.toggle("on", +a.dataset.i === i));
    }
    function waehle(i, fliegen = true) {
      sel = i; spin = false; hervorheben(i);
      const r = R[i]; if (!r) return;
      const a = list.querySelector(`.trip[data-i="${i}"]`); if (a && fliegen) a.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
      if (fliegen && r.bbox && map.loaded()) map.fitBounds([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], { padding: pad(), duration: reduced ? 0 : 2200, maxZoom: 7.5, pitch: 30 });
    }
    // Handy: beim Scrollen dreht sich der Globus zur Reise in der Mitte der Liste
    if ("IntersectionObserver" in window) {
      let zielT = null;
      let ioBereit = reduced; setTimeout(() => (ioBereit = true), 7000); document.getElementById("panel").addEventListener("scroll", () => (ioBereit = true), { passive: true, once: true });
      const io = new IntersectionObserver((eintr) => { if (!narrow() || tourOn || !ioBereit) return; const sicht = eintr.filter((x) => x.isIntersecting); if (!sicht.length) return;
        const i = +sicht[0].target.dataset.i; clearTimeout(zielT); zielT = setTimeout(() => { if (i !== sel) { stopSpin(); waehle(i); } }, 350); },
        { root: document.getElementById("panel"), rootMargin: "-45% 0px -45% 0px" });
      list.querySelectorAll(".trip").forEach((a) => io.observe(a));
    }
    list.addEventListener("mouseover", (e) => { const a = e.target.closest(".trip"); if (a && +a.dataset.i !== sel) waehle(+a.dataset.i); });
    list.addEventListener("focusin", (e) => { const a = e.target.closest(".trip"); if (a) waehle(+a.dataset.i); });
    document.getElementById("panel").addEventListener("mouseleave", () => { if (tourOn) return; sel = -1; hervorheben(-1); stopSpin(); });
    addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { waehle((sel + 1) % R.length); e.preventDefault(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { waehle((sel - 1 + R.length) % R.length); e.preventDefault(); }
      else if (e.key === "Enter" && sel >= 0 && document.activeElement === document.body) location.assign(`/atlas/${R[sel].slug}/`);
    });

    // Rundflug: von zu Hause zu jeder Reise und zurück
    const tourBtn = document.getElementById("tour");
    tourBtn.onclick = async () => {
      if (tourOn) { tourOn = false; tourBtn.textContent = "▶ Rundflug"; return; }
      tourOn = true; tourBtn.textContent = "❚❚ Anhalten";
      const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
      map.flyTo({ center: [D.zuhause.lon, D.zuhause.lat], zoom: 4, pitch: 0, duration: reduced ? 0 : 2500 }); await warte(2700);
      for (let i = R.length - 1; i >= 0 && tourOn; i--) { waehle(i); await warte(reduced ? 2500 : 4500); } // älteste zuerst
      if (tourOn) { sel = -1; hervorheben(-1); map.fitBounds(all(), { padding: pad(), duration: reduced ? 0 : 2500, maxZoom: 5 }); }
      tourOn = false; tourBtn.textContent = "▶ Rundflug";
    };
    // ---- Leiste oben (Handy hochkant): Rundflug + Kompass in der Insel, Lupe, Hilfe, Statistik ----
    const rund = document.getElementById("tbRund");
    rund.onclick = () => tourBtn.click(); new MutationObserver(() => (rund.textContent = tourBtn.textContent)).observe(tourBtn, { childList: true, characterData: true, subtree: true });
    const kn = document.querySelector("#tbKompass .kn"); const kUpd = () => { kn.style.transform = `rotate(${-map.getBearing()}deg)`; }; map.on("rotate", kUpd); kUpd();
    document.getElementById("tbKompass").onclick = () => map.easeTo({ bearing: 0, pitch: 0, duration: reduced ? 0 : 700 });
    const lu = document.getElementById("tbLupe"), box = document.getElementById("tbSuche"), heim = document.getElementById("panel");
    const teile = ["frageForm", "antwort", "treffer"].map((id) => document.getElementById(id)); const anker = document.getElementById("list");
    lu.onclick = () => { const auf = box.hidden; box.hidden = !auf; lu.setAttribute("aria-pressed", auf);
      if (auf) { teile.forEach((t) => box.appendChild(t)); such.focus(); } else { teile.forEach((t) => heim.insertBefore(t, anker)); } };
    const SCHRITTE = [["#topbar .tbBtn[href='/']", "Zurück", "Zur Startseite von renateundchris.com."], ["#insel", "Rundflug & Kompass", "▶ Rundflug fliegt von Linz aus alle Reisen ab. Kompass antippen richtet den Globus nach Norden."],
      ["#tbLupe", "Suchen & fragen", "Öffnet oben ein Suchfeld: Orte, Tage, Erlebnisse – oder eine Frage an die Reise."], ["#topbar a[href*='statistik']", "Statistik", "Kilometer, Wetter, Rekorde und Abzeichen aller Reisen."],
      ["#map", "Globus", "Mit zwei Fingern drehen und zoomen. Routen antippen wählt die Reise."], ["#list", "Reisen", "Beim Scrollen dreht sich der Globus zur Reise in der Mitte. Antippen = eintauchen, ▶ Teaser = 35-Sekunden-Film."]];
    let hilfe = null; const ib = document.getElementById("tbInfo");
    const hilfeZu = () => { if (hilfe) hilfe.remove(); hilfe = null; ib.setAttribute("aria-pressed", "false"); };
    const hilfeZeig = (i) => { hilfeZu(); const [sel, tit, txt] = SCHRITTE[i]; const el = document.querySelector(sel); if (!el) return; let r = el.getBoundingClientRect(); if (sel === "#map") r = { left: 20, top: 120, width: innerWidth - 40, height: innerHeight * 0.25 };
      if (sel === "#list") r = { left: r.left, top: Math.max(r.top, innerHeight * 0.45), width: r.width, height: Math.min(200, innerHeight * 0.3) };
      ib.setAttribute("aria-pressed", "true"); hilfe = document.createElement("div"); hilfe.id = "hilfe"; const unten = r.top + r.height / 2 < innerHeight / 2;
      hilfe.innerHTML = `<div class="hLoch" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></div><div class="hBox" style="${unten ? `top:${Math.min(innerHeight - 220, r.top + r.height + 16)}px` : `bottom:${innerHeight - r.top + 16}px`}"><b>${tit}</b><p>${txt}</p><div class="hNav"><span>${i + 1} / ${SCHRITTE.length}</span>${i ? '<button data-h="z">‹ Zurück</button>' : ""}<button data-h="w" class="pri">${i + 1 < SCHRITTE.length ? "Weiter ›" : "Fertig"}</button></div></div>`;
      hilfe.onclick = (e) => { const b = e.target.closest("[data-h]"); if (b && b.dataset.h === "z") return hilfeZeig(i - 1); if (b || !e.target.closest(".hBox")) { if (i + 1 < SCHRITTE.length) hilfeZeig(i + 1); else hilfeZu(); } };
      document.body.appendChild(hilfe); };
    ib.onclick = () => (hilfe ? hilfeZu() : hilfeZeig(0));
  }
})();
