/* Reise-Statistik – Dashboard für eine Reise oder alle Reisen.
   Daten: /atlas/data/statistik.json (beim Bauen erzeugt: km, Stationen, Fotos, Sonnenzeiten, Stützpunkte der Route).
   Im Browser nachgeladen und zwischengespeichert: Wetter (Open-Meteo Archiv) und Höhen (Open-Meteo Elevation). */
(function () {
  "use strict";
  const ROOT = document.getElementById("stat");
  const V = ROOT.dataset.v || "";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n0 = (x) => Math.round(x).toLocaleString("de-AT");
  const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString("de-AT");
  const fmtDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
  const fmtDateY = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("de-AT", { day: "numeric", month: "short", year: "numeric" });
  const mins = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
  const LAND = { AT: "Österreich", SI: "Slowenien", HR: "Kroatien", ME: "Montenegro", AL: "Albanien", GR: "Griechenland", MK: "Nordmazedonien", RS: "Serbien",
    BA: "Bosnien und Herzegowina", XK: "Kosovo", BG: "Bulgarien", RO: "Rumänien", HU: "Ungarn", SK: "Slowakei", CZ: "Tschechien", PL: "Polen", DE: "Deutschland",
    CH: "Schweiz", IT: "Italien", FR: "Frankreich", ES: "Spanien", PT: "Portugal", TR: "Türkei", NL: "Niederlande", BE: "Belgien", LU: "Luxemburg", DK: "Dänemark",
    NO: "Norwegen", SE: "Schweden", FI: "Finnland", GB: "Großbritannien", IE: "Irland" };
  const merk = { get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
                 set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------- Wetter-Symbole (WMO-Codes) ----------
  function wmo(c) {
    if (c == null) return ["·", "unbekannt"];
    if (c === 0) return ["☀️", "klar"];
    if (c <= 2) return ["🌤️", "heiter"];
    if (c === 3) return ["☁️", "bedeckt"];
    if (c <= 48) return ["🌫️", "Nebel"];
    if (c <= 57) return ["🌦️", "Niesel"];
    if (c <= 67) return ["🌧️", "Regen"];
    if (c <= 77) return ["🌨️", "Schnee"];
    if (c <= 82) return ["🌦️", "Schauer"];
    if (c <= 86) return ["🌨️", "Schneeschauer"];
    return ["⛈️", "Gewitter"];
  }

  // ---------- Nachladen: Wetter und Höhen (Open-Meteo, CC BY 4.0) ----------
  const WKEY = (s) => "atlas.stat.wetter.v1." + s, HKEY = (s) => "atlas.stat.hoehe.v1." + s;
  async function ladeWetter(r) {
    const c = merk.get(WKEY(r.slug)); if (c) return c;
    const tage = r.tage.filter((d) => d.ort && d.datum);
    if (!tage.length) return {};
    const out = {};
    for (let i = 0; i < tage.length; i += 40) {
      const g = tage.slice(i, i + 40);
      const q = new URLSearchParams({ latitude: g.map((d) => d.ort.lat).join(","), longitude: g.map((d) => d.ort.lon).join(","),
        start_date: tage[0].datum, end_date: tage[tage.length - 1].datum, timezone: "auto",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration,wind_speed_10m_max" });
      const j = await fetch("https://archive-api.open-meteo.com/v1/archive?" + q).then((x) => { if (!x.ok) throw new Error(x.status); return x.json(); });
      const arr = Array.isArray(j) ? j : [j];
      g.forEach((d, k) => { const dl = (arr[k] || {}).daily; if (!dl) return; const ix = dl.time.indexOf(d.datum); if (ix < 0) return;
        out[d.tag] = { code: dl.weather_code[ix], max: dl.temperature_2m_max[ix], min: dl.temperature_2m_min[ix], regen: dl.precipitation_sum[ix],
          sonneH: dl.sunshine_duration[ix] != null ? dl.sunshine_duration[ix] / 3600 : null, wind: dl.wind_speed_10m_max[ix] }; });
    }
    if (Object.keys(out).length) merk.set(WKEY(r.slug), out);
    return out;
  }
  async function ladeHoehe(r) {
    const c = merk.get(HKEY(r.slug)); if (c) return c;
    const pts = []; r.tage.forEach((d) => (d.hp || []).forEach((p, i) => pts.push({ tag: d.tag, i, p })));
    const out = {};
    for (let i = 0; i < pts.length; i += 100) {
      const g = pts.slice(i, i + 100);
      const q = new URLSearchParams({ latitude: g.map((x) => x.p[0]).join(","), longitude: g.map((x) => x.p[1]).join(",") });
      const j = await fetch("https://api.open-meteo.com/v1/elevation?" + q).then((x) => { if (!x.ok) throw new Error(x.status); return x.json(); });
      g.forEach((x, k) => { (out[x.tag] ||= [])[x.i] = Math.max(0, Math.round(j.elevation[k])); });
    }
    if (Object.keys(out).length) merk.set(HKEY(r.slug), out);
    return out;
  }

  // ---------- Auswertung ----------
  const LEVEL = [[0, "Spaziergänger"], [500, "Ausflügler"], [1500, "Landstraßen-Kenner"], [3000, "Küstenstraßen-Profi"], [5000, "Pass-Bezwinger"],
    [8000, "Grenzgänger"], [12000, "Fernfahrer"], [17000, "Adria-Veteran"], [23000, "Kontinent-Kenner"], [30000, "Atlas-Legende"]];

  function auswerten(reisen) {
    const tage = reisen.flatMap((r) => r.tage.map((d) => ({ ...d, reise: r }))); // alle Tage der Auswahl
    const sum = (f) => tage.reduce((a, d) => a + (f(d) || 0), 0);
    const laender = {}; tage.forEach((d) => (d.land || []).forEach((c) => (laender[c] = (laender[c] || 0) + 1)));
    const W = (d) => (d.reise.wetter || {})[d.tag], H = (d) => (d.reise.hoehe || {})[d.tag];
    tage.forEach((d) => { const h = H(d); d.w = W(d) || null;
      d.h = h && h.length ? { max: Math.max(...h), min: Math.min(...h), auf: h.reduce((a, x, i) => a + (i && x > h[i - 1] ? x - h[i - 1] : 0), 0), profil: h } : null;
      // Fotos rund um Sonnenauf- und -untergang
      const s = d.sonne; d.frueh = 0; d.gold = 0;
      if (s) for (const z of d.fotoZeiten || []) { const m = mins(z); if (Math.abs(m - mins(s.auf)) <= 30) d.frueh++; if (m <= mins(s.unter) + 15 && m >= mins(s.unter) - 45) d.gold++; }
    });
    const mitW = tage.filter((d) => d.w && d.w.max != null);
    const best = (list, f, low) => list.reduce((b, d) => { const v = f(d); if (v == null || Number.isNaN(v)) return b; return !b || (low ? v < b.v : v > b.v) ? { d, v } : b; }, null);
    const A = {
      reisen: reisen.length, tage: tage.length, km: sum((d) => d.km), fahrMin: sum((d) => d.fahrMin), stationen: sum((d) => d.stationen),
      fotos: sum((d) => d.fotos), faehren: sum((d) => d.faehren), grenzen: sum((d) => d.grenzen), pannen: sum((d) => d.pannen), essen: sum((d) => d.essen),
      laender, nLaender: Object.keys(laender).length, ruhetage: tage.filter((d) => !d.km).length,
      hm: tage.some((d) => d.h) ? sum((d) => d.h && d.h.auf) : null,
      sonneH: mitW.length ? sum((d) => d.w && d.w.sonneH) : null, regen: mitW.length ? sum((d) => d.w && d.w.regen) : null,
      tmaxAvg: mitW.length ? mitW.reduce((a, d) => a + d.w.max, 0) / mitW.length : null,
      frueh: sum((d) => d.frueh), gold: sum((d) => d.gold), wetterDa: mitW.length, wetterSoll: tage.length, hoeheDa: tage.some((d) => d.h),
      rek: {
        etappe: best(tage, (d) => d.km || null), heiss: best(mitW, (d) => d.w.max), kuehl: best(mitW, (d) => d.w.min, true),
        nass: best(mitW, (d) => d.w.regen || null), sonnig: best(mitW, (d) => d.w.sonneH), wind: best(mitW, (d) => d.w.wind),
        hoch: best(tage.filter((d) => d.h), (d) => d.h.max), auf: best(tage.filter((d) => d.h), (d) => d.h.auf || null),
        frueh: best(tage.filter((d) => d.sonne), (d) => mins(d.sonne.auf), true), spaet: best(tage.filter((d) => d.sonne), (d) => mins(d.sonne.unter)),
        lang: best(tage.filter((d) => d.sonne), (d) => d.sonne.min), fotos: best(tage, (d) => d.fotos || null),
      },
      tageListe: tage,
    };
    A.xp = Math.round(A.km + 150 * A.nLaender + 25 * A.tage + A.fotos + 40 * A.faehren);
    let li = 0; LEVEL.forEach((l, i) => { if (A.xp >= l[0]) li = i; });
    A.level = { nr: li + 1, name: LEVEL[li][1], von: LEVEL[li][0], bis: (LEVEL[li + 1] || [null])[0], next: (LEVEL[li + 1] || [0, null])[1] };
    return A;
  }

  // Abzeichen: [Symbol, Name, Bedingung, Wert, Ziel, Einheit]
  function abzeichen(A, alle) {
    const r = A.rek, v = (x) => (x ? x.v : 0);
    const L = [
      ["🛣️", "Tausender", "1.000 km gefahren", A.km, 1000, "km"],
      ["🚐", "Marathon-Etappe", "ein Tag mit 400 km", v(r.etappe), 400, "km"],
      ["🛂", "Grenzgänger", "5 Länder", A.nLaender, 5, "Länder"],
      ["⛴️", "Fährmann", "5 Fährfahrten", A.faehren, 5, "Fähren"],
      ["📸", "Fotojäger", "300 Fotos im Atlas", A.fotos, 300, "Fotos"],
      ["🌅", "Frühaufsteher", "Foto um Sonnenaufgang", A.frueh, 1, "Fotos"],
      ["🌇", "Goldene Stunde", "10 Fotos vor Sonnenuntergang", A.gold, 10, "Fotos"],
      ["🏖️", "Füße hoch", "ein Tag ohne Fahrt", A.ruhetage, 1, "Tage"],
      ["🗓️", "Langstrecke", "30 Tage unterwegs", A.tage, 30, "Tage"],
      ["🔧", "Pannenprofi", "eine Panne gemeistert", A.pannen, 1, "Pannen"],
      ["🔥", "Hitzefrei", "ein Tag mit 35 °C", A.wetterDa ? v(r.heiss) : null, 35, "°C"],
      ["☀️", "Sonnenanbeter", "ein Tag mit 13 Sonnenstunden", A.wetterDa ? v(r.sonnig) : null, 13, "h"],
      ["🌧️", "Regenfest", "ein Tag mit 10 mm Regen", A.wetterDa ? v(r.nass) : null, 10, "mm"],
      ["⛰️", "Gipfelstürmer", "Route über 1.500 m", A.hoeheDa ? v(r.hoch) : null, 1500, "m"],
    ];
    if (alle) L.push(["🧭", "Stammgäste", "3 Reisen im Atlas", A.reisen, 3, "Reisen"], ["🌍", "Länderkönig", "10 Länder", A.nLaender, 10, "Länder"]);
    return L.map(([i, n, b, wert, ziel, e]) => ({ i, n, b, wert, ziel, e, ok: wert != null && wert >= ziel }));
  }

  // ---------- Darstellung ----------
  let DATA, SEL = "alle";
  const atlasLink = (d) => `/atlas/${d.reise.slug}/?tag=${d.tag}`;
  const wo = (d, alle) => `Tag ${d.tag}${d.ort ? " · " + esc(d.ort.name) : ""}${alle ? " · " + esc(d.reise.title) : ""}`;

  function sparkline(p, w, h) {
    if (!p || p.length < 2) return "";
    const mx = Math.max(...p), mn = Math.min(...p), sp = Math.max(50, mx - mn);
    const pts = p.map((v, i) => `${(i / (p.length - 1)) * w},${h - 2 - ((v - mn) / sp) * (h - 4)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,${h} ${pts} ${w},${h}"/><polyline points="${pts}"/></svg>`;
  }

  function kurve(tage) { // km als Balken, Höchst-/Tiefsttemperatur als Linien
    const W = 1000, H = 220, P = 30, n = tage.length; if (!n) return "";
    const bw = (W - 2 * P) / n, kmMax = Math.max(100, ...tage.map((d) => d.km || 0));
    const t = tage.filter((d) => d.w && d.w.max != null);
    const tMin = Math.min(5, ...t.map((d) => d.w.min)), tMax = Math.max(30, ...t.map((d) => d.w.max));
    const y = (v) => H - P - ((v - tMin) / (tMax - tMin)) * (H - 2 * P), x = (i) => P + bw * (i + 0.5);
    const bars = tage.map((d, i) => `<rect x="${P + bw * i + bw * 0.18}" width="${bw * 0.64}" y="${H - P - ((d.km || 0) / kmMax) * (H - 2 * P)}" height="${((d.km || 0) / kmMax) * (H - 2 * P)}" rx="2"><title>Tag ${d.tag}: ${n0(d.km || 0)} km</title></rect>`).join("");
    const lin = (f) => tage.map((d, i) => (d.w && d.w.max != null ? `${x(i)},${y(f(d))}` : null)).filter(Boolean).join(" ");
    const ticks = [0, 10, 20, 30, 40].filter((v) => v >= tMin && v <= tMax).map((v) => `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}"/><text x="${P - 6}" y="${y(v) + 4}" text-anchor="end">${v}°</text>`).join("");
    const dayLbl = tage.map((d, i) => (n <= 12 || i % 5 === 0 || i === n - 1 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${d.tag}</text>` : "")).join("");
    return `<figure class="kurve"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilometer und Temperatur je Tag"><g class="grid">${ticks}</g><g class="bars">${bars}</g>${t.length ? `<polyline class="tmax" points="${lin((d) => d.w.max)}"/><polyline class="tmin" points="${lin((d) => d.w.min)}"/>` : ""}<g class="lbl">${dayLbl}</g></svg>
      <figcaption><span><i class="k-bar"></i>km je Tag</span>${t.length ? '<span><i class="k-max"></i>Höchsttemperatur</span><span><i class="k-min"></i>Tiefsttemperatur</span>' : ""}<span class="mono">Tag →</span></figcaption></figure>`;
  }

  function render() {
    const reisen = DATA.reisen, alle = SEL === "alle";
    const auswahl = alle ? reisen : reisen.filter((r) => r.slug === SEL);
    const R = auswahl[0];
    const A = auswerten(auswahl);
    const L = A.level, pct = L.bis ? Math.min(100, ((A.xp - L.von) / (L.bis - L.von)) * 100) : 100;
    const badges = abzeichen(A, alle), nOk = badges.filter((b) => b.ok).length;
    const laden = auswahl.some((r) => r.status === "laedt");
    const fehler = auswahl.some((r) => r.status === "fehler");
    const rk = A.rek;
    const rekord = (icon, titel, x, wert) => x ? `<a class="rek" href="${atlasLink(x.d)}"><span class="ri">${icon}</span><span class="rt">${titel}</span><b>${wert(x)}</b><span class="rw">${wo(x.d, alle)}</span></a>` : "";
    const kpi = (wert, label, sub) => `<div class="kpi"><b>${wert}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;

    let h = `<header class="top">
      <a class="back" href="${alle ? "/atlas/" : `/atlas/${R.slug}/`}">← Atlas</a>
      <div class="ttl"><span class="eyebrow">Renate &amp; Chris · Reise-Atlas</span><h1>Reise-Statistik</h1></div>
      <nav class="tabs" aria-label="Auswahl">${[["alle", "Alle Reisen"], ...reisen.map((r) => [r.slug, r.title])].map(([k, n]) => `<a href="#${k}" class="${k === SEL ? "on" : ""}" ${k === SEL ? 'aria-current="page"' : ""}>${esc(n)}</a>`).join("")}</nav>
    </header>`;

    h += `<section class="hero"${!alle ? ` style="--acc:${esc(R.accent)}"` : ""}>
      <div class="lvl"><div class="badge-lvl"><span>Level</span><b>${L.nr}</b></div>
        <div class="lvlTxt"><span class="eyebrow">${alle ? "Unser Reise-Level" : "Level dieser Reise"}</span><h2>${esc(L.name)}</h2>
          <div class="xpbar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
          <span class="mono xp">${n0(A.xp)} XP${L.bis ? ` · noch ${n0(L.bis - A.xp)} bis „${esc(L.next)}“` : " · höchste Stufe"}</span></div></div>
      <p class="xpinfo">XP: 1 je km · 150 je Land · 25 je Tag · 1 je Foto · 40 je Fähre</p>
    </section>`;

    h += `<section class="kpis">
      ${alle ? kpi(A.reisen, "Reisen") : ""}${kpi(A.tage, "Tage", alle ? "" : `${fmtDateY(R.tage[0].datum)} – ${fmtDateY(R.tage[R.tage.length - 1].datum)}`)}
      ${kpi(n0(A.km), "km", `${n0(A.fahrMin / 60)} h am Steuer`)}${kpi(A.nLaender, A.nLaender === 1 ? "Land" : "Länder")}
      ${kpi(A.stationen, "Stationen")}${kpi(A.fotos, "Fotos")}${kpi(A.faehren, "Fähren")}
      ${kpi(A.hm != null ? n0(A.hm) : "…", "Höhenmeter", "bergauf, grob geschätzt")}
      ${kpi(A.sonneH != null ? n0(A.sonneH) : "…", "Sonnenstunden")}${kpi(A.tmaxAvg != null ? n1(A.tmaxAvg) + "°" : "…", "Ø Höchsttemperatur")}
    </section>`;
    if (laden) h += `<p class="status">Wetter und Höhen werden geladen …</p>`;
    if (fehler) h += `<p class="status warn">Wetter oder Höhen konnten gerade nicht geladen werden. Kennzahlen und Sonnenzeiten stimmen trotzdem.</p>`;

    if (!alle) h += `<section><h3>Reise-Kurve</h3>${kurve(R.tage.map((d) => A.tageListe.find((x) => x.tag === d.tag)))}</section>`;

    h += `<section><h3>Rekorde</h3><div class="reks">
      ${rekord("🚐", "Längste Etappe", rk.etappe, (x) => n0(x.v) + " km")}
      ${rekord("🔥", "Heißester Tag", rk.heiss, (x) => n1(x.v) + " °C")}
      ${rekord("❄️", "Kühlste Nacht", rk.kuehl, (x) => n1(x.v) + " °C")}
      ${rekord("☀️", "Sonnigster Tag", rk.sonnig, (x) => n1(x.v) + " h Sonne")}
      ${rekord("🌧️", "Nassester Tag", rk.nass, (x) => n1(x.v) + " mm")}
      ${rekord("💨", "Windigster Tag", rk.wind, (x) => n0(x.v) + " km/h")}
      ${rekord("⛰️", "Höchster Punkt", rk.hoch, (x) => n0(x.v) + " m")}
      ${rekord("📈", "Meiste Höhenmeter", rk.auf, (x) => "≈ " + n0(x.v) + " m")}
      ${rekord("🌅", "Frühester Sonnenaufgang", rk.frueh, (x) => x.d.sonne.auf + " Uhr")}
      ${rekord("🌇", "Spätester Sonnenuntergang", rk.spaet, (x) => x.d.sonne.unter + " Uhr")}
      ${rekord("⏳", "Längster Tag", rk.lang, (x) => `${Math.floor(x.v / 60)} h ${x.v % 60} min Licht`)}
      ${rekord("📸", "Meiste Fotos", rk.fotos, (x) => x.v + " Fotos")}
    </div></section>`;

    h += `<section><h3>Abzeichen <span class="mono cnt">${nOk}/${badges.length}</span></h3><div class="badges">${badges.map((b) => {
      const p = b.wert == null ? 0 : Math.min(100, (b.wert / b.ziel) * 100);
      return `<div class="bdg ${b.ok ? "ok" : ""}" title="${esc(b.b)}"><span class="bi">${b.i}</span><b>${esc(b.n)}</b><span class="bb">${esc(b.b)}</span>
        ${b.ok ? '<span class="bs">freigeschaltet</span>' : `<span class="bp"><i style="width:${p}%"></i></span><span class="bs">${b.wert == null ? "lädt …" : `${n0(b.wert)} / ${n0(b.ziel)} ${b.e}`}</span>`}</div>`; }).join("")}</div></section>`;

    h += `<section><h3>Länder-Stempel</h3><div class="stamps">${Object.entries(A.laender).sort((a, b) => b[1] - a[1]).map(([c, t], i) =>
      `<div class="stamp" style="--r:${((i * 37) % 17) - 8}deg"><span class="sc">${c}</span><span class="sn">${esc(LAND[c] || c)}</span><span class="st">${t} ${t === 1 ? "Tag" : "Tage"}</span></div>`).join("")}</div></section>`;

    if (alle && reisen.length > 1) h += quartett(reisen);
    if (!alle) h += `<section><h3>Tag für Tag</h3><div class="days">${R.tage.map((d0) => { const d = A.tageListe.find((x) => x.tag === d0.tag); const [ic, wt] = wmo(d.w && d.w.code);
      return `<a class="day" href="${atlasLink(d)}"><span class="dh"><b>Tag ${d.tag}</b><span>${fmtDate(d.datum)}</span></span>
        <span class="dw" title="${esc(wt)}">${d.w ? ic : "…"}<b>${d.w && d.w.max != null ? n0(d.w.max) + "°" : ""}</b><small>${d.w && d.w.min != null ? n0(d.w.min) + "°" : ""}</small></span>
        <span class="do">${esc(d.ort ? d.ort.name : d.titel)}</span>
        <span class="dk mono">${d.km ? "🚐 " + n0(d.km) + " km" : "🏖️ ohne Fahrt"}${d.fotos ? " · 📸 " + d.fotos : ""}</span>
        ${d.sonne ? `<span class="ds mono">↑ ${d.sonne.auf} · ↓ ${d.sonne.unter}</span>` : ""}
        ${d.h ? sparkline(d.h.profil, 160, 34) + `<span class="dh2 mono">${n0(d.h.min)}–${n0(d.h.max)} m</span>` : ""}</a>`; }).join("")}</div></section>`;

    h += `<footer class="foot"><p>Quellen: Kilometer und Fahrzeit aus Straßenrouten (OSRM, Näherung zwischen den Stationen, nicht die GPS-Spur). Sonnenzeiten berechnet für den Übernachtungsort (Ortszeit). Wetter und Höhen: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0), Tageswerte am Übernachtungsort, Höhen aus Copernicus DEM entlang der Route (grob, ca. 24 Punkte je Tag).</p>
      <p><a href="/reisen">Alle Reisen</a> · <a href="/datenschutz">Datenschutz</a></p></footer>`;
    ROOT.innerHTML = h;
    const tq = document.getElementById("trumpf"); if (tq) tq.onclick = () => trumpf(reisen);
    document.title = (alle ? "Reise-Statistik" : `Statistik · ${R.title}`) + " · Renate & Chris";
  }

  // Quartett: jede Reise eine Karte, der beste Wert je Zeile gewinnt
  const QW = [["Tage", (A) => A.tage, (v) => v], ["Kilometer", (A) => A.km, n0], ["Länder", (A) => A.nLaender, (v) => v], ["Stationen", (A) => A.stationen, (v) => v],
    ["Fotos", (A) => A.fotos, (v) => v], ["Ø Höchsttemp.", (A) => A.tmaxAvg, (v) => n1(v) + "°"], ["Höchster Punkt", (A) => (A.rek.hoch ? A.rek.hoch.v : null), (v) => n0(v) + " m"], ["XP", (A) => A.xp, n0]];
  function quartett(reisen) {
    const As = reisen.map((r) => auswerten([r]));
    const top = QW.map(([, f]) => Math.max(...As.map((A) => f(A) ?? -Infinity)));
    return `<section><h3>Reise-Quartett <button class="chipBtn" id="trumpf">🃏 Trumpf ziehen</button></h3><p class="note" id="trumpfTxt">Jede Reise ist eine Karte – der höchste Wert sticht.</p><div class="cards">${reisen.map((r, i) =>
      `<article class="qcard" style="--acc:${esc(r.accent)}" data-slug="${esc(r.slug)}"><header><span class="mono">${String.fromCharCode(65 + i)}${i + 1}</span><h4>${esc(r.title)}</h4></header><dl>${QW.map(([n, f, fm], k) => {
        const v = f(As[i]); return `<div class="${v != null && v === top[k] ? "win" : ""}" data-k="${k}"><dt>${n}</dt><dd>${v == null ? "…" : fm(v)}</dd></div>`; }).join("")}</dl><a href="#${esc(r.slug)}">Details →</a></article>`).join("")}</div></section>`;
  }
  function trumpf(reisen) {
    const As = reisen.map((r) => auswerten([r]));
    const opts = QW.map((q, k) => k).filter((k) => As.every((A) => QW[k][1](A) != null));
    const k = opts[Math.floor(Math.random() * opts.length)];
    const vals = As.map((A) => QW[k][1](A)), mx = Math.max(...vals), win = reisen.filter((r, i) => vals[i] === mx);
    document.querySelectorAll(".qcard dl > div").forEach((el) => el.classList.toggle("pick", +el.dataset.k === k));
    document.querySelectorAll(".qcard").forEach((el) => el.classList.toggle("winner", win.some((r) => r.slug === el.dataset.slug)));
    document.getElementById("trumpfTxt").textContent = `Gezogen: ${QW[k][0]} – es sticht ${win.map((r) => r.title).join(" und ")} mit ${QW[k][2](mx)}.`;
  }

  // ---------- Start ----------
  async function nachladen(r) {
    if (r.status) return; r.status = "laedt"; render();
    const [w, hh] = await Promise.allSettled([ladeWetter(r), ladeHoehe(r)]);
    if (w.status === "fulfilled") r.wetter = w.value; if (hh.status === "fulfilled") r.hoehe = hh.value;
    r.status = w.status === "rejected" || hh.status === "rejected" ? "fehler" : "fertig";
    render();
  }
  function route() {
    const k = decodeURIComponent(location.hash.slice(1));
    SEL = DATA.reisen.some((r) => r.slug === k) ? k : "alle";
    render(); window.scrollTo(0, 0);
    (SEL === "alle" ? DATA.reisen : DATA.reisen.filter((r) => r.slug === SEL)).forEach(nachladen);
  }
  fetch("/atlas/data/statistik.json?v=" + V).then((r) => r.json()).then((d) => {
    DATA = d;
    DATA.reisen.forEach((r) => { r.wetter = merk.get(WKEY(r.slug)); r.hoehe = merk.get(HKEY(r.slug)); if (r.wetter && r.hoehe) r.status = "fertig"; });
    addEventListener("hashchange", route); route();
  }).catch(() => { ROOT.innerHTML = '<p class="status warn">Die Statistik konnte nicht geladen werden. Bitte Seite neu laden.</p>'; });
})();
