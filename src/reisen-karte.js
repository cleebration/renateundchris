/* Reisekarte – Client (v2: Übernachtung/Essen liegen über den Fotopunkten). Leaflet + OpenStreetMap, keine weiteren Abhängigkeiten. */
(function () {
  "use strict";
  const WD = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  const MO = ["Jänner","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const datum = (s) => { const d = new Date(s + "T12:00:00"); return `${WD[d.getDay()]}, ${d.getDate()}. ${MO[d.getMonth()]} ${d.getFullYear()}`; };
  const zahl = (n) => String(n).replace(".", ",");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function kopf(t) {
    const x = [datum(t.datum)];
    if (t.km.auto) x.push(`Auto ${zahl(t.km.auto)} km`);
    if (t.km.rad) x.push(`Rad ca. ${zahl(t.km.rad)} km`);
    if (t.uebernachtung) x.push(`Übernachtung: ${t.uebernachtung.name}`);
    return x.join(" · ");
  }

  const STIL = {
    auto:   () => ({ color: css("--k-auto") || "#1F5A96", weight: 4, opacity: .9 }),
    rad:    () => ({ color: css("--k-rad") || "#B07A1A", weight: 3.5, opacity: .95 }),
    faehre: () => ({ color: css("--k-auto") || "#1F5A96", weight: 3, opacity: .8, dashArray: "2 7", lineCap: "round" }),
  };

  function pin(text, klasse) {
    return L.divIcon({ className: "", html: `<span class="k-pin ${klasse}">${esc(text)}</span>`, iconSize: null });
  }

  function start(el) {
    const D = JSON.parse(el.querySelector(".r-karte-daten").textContent);
    const box = el.querySelector(".r-karte-map");
    const map = L.map(box, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map);
    // Mausrad erst nach Klick in die Karte, damit die Seite normal scrollt
    map.on("click", () => map.scrollWheelZoom.enable());
    box.addEventListener("mouseleave", () => map.scrollWheelZoom.disable());

    const orteName = Object.fromEntries((D.orte || []).map((o) => [o.id, o.name]));
    let ebene = L.layerGroup().addTo(map);
    const kopfEl = el.querySelector(".r-karte-kopf");

    function zeichne(tage) {
      ebene.clearLayers();
      const b = [];
      for (const t of tage) {
        for (const w of t.wege) {
          if (!w.pts.length) continue;
          L.polyline(w.pts, STIL[w.typ] ? STIL[w.typ]() : STIL.auto())
            .bindTooltip(esc(w.label + (w.km ? ` · ${zahl(w.km)} km` : "")), { sticky: true })
            .addTo(ebene);
          b.push(...w.pts);
        }
        const u = t.uebernachtung;
        if (u) {
          L.marker([u.lat, u.lon], { icon: pin(D.modus === "reise" ? t.tag : "⌂", "k-nacht"), zIndexOffset: 1000 })
            .bindPopup(`<b>${D.modus === "reise" ? `Tag ${t.tag} · ` : ""}${esc(u.name)}</b>` +
              (u.adresse ? `<br>${esc(u.adresse)}` : "") +
              (t.url ? `<br><a href="${t.url}">${esc(t.titel)} →</a>` : ""))
            .addTo(ebene);
          b.push([u.lat, u.lon]);
        }
        if (D.modus !== "tag") continue;
        if (t.essen) {
          L.marker([t.essen.lat, t.essen.lon], { icon: pin("🍴", "k-essen"), zIndexOffset: 1000 })
            .bindPopup(`<b>${esc(t.essen.name)}</b>` + (t.essen.adresse ? `<br>${esc(t.essen.adresse)}` : "") +
              (t.essen.tripadvisor ? `<br><a href="${t.essen.tripadvisor}" target="_blank" rel="noopener">Tripadvisor →</a>` : "")).addTo(ebene);
        }
        for (const f of t.fotos) {
          L.marker([f.lat, f.lon], { icon: pin(f.nr, "k-foto") })
            .bindPopup(`<img class="k-thumb" src="${f.src}" alt=""><br>${esc(f.text)}` +
              `<br><a href="#bild-${encodeURIComponent(f.datei)}">zum Bild ↓</a>`, { maxWidth: 260 })
            .addTo(ebene);
          b.push([f.lat, f.lon]);
        }
      }
      if (b.length) map.fitBounds(b, { padding: [24, 24], maxZoom: 15 });
      if (kopfEl) kopfEl.textContent = tage.length === 1 ? kopf(tage[0]) :
        `${tage.length} Tage · Auto ${zahl(Math.round(tage.reduce((s, t) => s + t.km.auto, 0)))} km`;
    }

    if (D.modus === "tag") { zeichne(D.tage); return; }

    // Filter auf der Reise-Seite: Tag · Region · Ort
    const sel = el.querySelector(".f-tag");
    const chipR = el.querySelector(".f-region");
    const chipO = el.querySelector(".f-ort");
    const state = { tag: "", region: new Set(), ort: new Set() };
    for (const t of D.tage) sel.insertAdjacentHTML("beforeend", `<option value="${t.tag}">Tag ${t.tag} · ${esc(t.titel)}</option>`);
    const alle = (k) => [...new Set(D.tage.flatMap((t) => t[k]))];
    function chips(host, werte, key, name) {
      host.innerHTML = werte.map((v) => `<button type="button" class="chip" aria-pressed="false" data-v="${esc(v)}">${esc(name(v))}</button>`).join("");
      host.addEventListener("click", (e) => {
        const b = e.target.closest(".chip"); if (!b) return;
        const v = b.dataset.v, s = state[key];
        s.has(v) ? s.delete(v) : s.add(v);
        b.setAttribute("aria-pressed", s.has(v) ? "true" : "false");
        filtern();
      });
    }
    chips(chipR, alle("regionen"), "region", (v) => v);
    chips(chipO, alle("orte"), "ort", (v) => orteName[v] || v);
    sel.addEventListener("change", () => { state.tag = sel.value; filtern(); });
    function filtern() {
      const tage = D.tage.filter((t) =>
        (!state.tag || String(t.tag) === state.tag) &&
        (!state.region.size || t.regionen.some((r) => state.region.has(r))) &&
        (!state.ort.size || t.orte.some((o) => state.ort.has(o))));
      zeichne(tage.length ? tage : D.tage);
    }
    filtern();
  }

  function init() {
    if (!window.L) return setTimeout(init, 50);
    document.querySelectorAll(".r-karte").forEach(start);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
