/* Reise-Atlas · Weltkugel – alle Reisen auf einem drehbaren Globus (MapLibre 5, Projektion „globe“).
   Daten: /atlas/data/welt.json (beim Bauen erzeugt). Karte: OpenFreeMap. */
(function () {
  "use strict";
  const ROOT = document.getElementById("welt");
  const V = ROOT.dataset.v || "";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n0 = (x) => Math.round(x).toLocaleString("de-AT");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = () => innerWidth < 760;

  ROOT.innerHTML = `<div id="map" aria-label="Weltkugel mit allen Reisen"></div>
    <aside id="panel">
      <header><span class="eyebrow">Renate &amp; Chris · Reise-Atlas</span><h1>Unsere Reisen</h1><p class="sum mono" id="sum"></p>
        <div class="acts"><button class="btn primary" id="tour">▶ Rundflug</button><a class="btn" href="/atlas/statistik/">📊 Statistik</a><a class="btn" href="/reisen">Liste</a></div></header>
      <input id="such" type="search" placeholder="🔎 Alle Reisen durchsuchen …" aria-label="Alle Reisen durchsuchen">
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
  such.placeholder = "🔎 Suchen – oder fragen + Enter ✨";
  such.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return; const f = such.value.trim(); if (f.length < 3) return;
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
    document.getElementById("list").innerHTML = '<li class="err">Die Reisen konnten nicht geladen werden. <a href="/reisen">Zur Liste</a></li>';
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
    const map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/liberty", center: [14, 30], zoom: narrow() ? 0.9 : 1.4,
      attributionControl: false, maxPitch: 60 });
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Routen: OSRM (Näherung)" }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");

    let sel = -1, spin = !reduced, idleT = null, tourOn = false;
    const all = () => { const b = R.filter((r) => r.bbox).map((r) => r.bbox); return [[Math.min(...b.map((x) => x[0]), D.zuhause.lon), Math.min(...b.map((x) => x[1]), D.zuhause.lat)], [Math.max(...b.map((x) => x[2]), D.zuhause.lon), Math.max(...b.map((x) => x[3]), D.zuhause.lat)]]; };
    const pad = () => (narrow() ? { top: 60, bottom: Math.round(innerHeight * 0.48), left: 70, right: 70 } : { top: 80, bottom: 80, left: 440, right: 80 });

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
      if (!reduced) setTimeout(() => { if (sel < 0 && !tourOn) map.fitBounds(all(), { padding: pad(), duration: 3500, maxZoom: 5 }); }, 1600);
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
  }
})();
