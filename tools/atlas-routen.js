// Reise-Atlas: Straßenrouten je Tag mit OSRM berechnen.
// Ausführen in der Browser-Konsole auf https://router.project-osrm.org/ (dort ist fetch erlaubt).
// 1. Unten bei W die Wegpunkte je Tag einsetzen: {"1": [[lon,lat],[lon,lat],…], "2": …}
//    (Start = letzte Station des Vortags, dann die Stationen des Tages in Reihenfolge)
// 2. Ausführen, warten (1 Anfrage pro Sekunde, Fair-Use des öffentlichen Servers)
// 3. copy(JSON.stringify(window.__routen)) und als "tage" in content/reisen/<reise>/_routen.json einsetzen
const W = {};
const out = {};
for (const [t, pts] of Object.entries(W)) {
  if (pts.length < 2) continue;
  const c = pts.map((p) => p.join(",")).join(";");
  const r = await fetch(`/route/v1/driving/${c}?overview=full&geometries=polyline&steps=false`).then((r) => r.json());
  if (r.code === "Ok") out[t] = { km: Math.round(r.routes[0].distance / 100) / 10, min: Math.round(r.routes[0].duration / 60), poly: r.routes[0].geometry };
  else console.warn("Tag", t, r.code);
  await new Promise((r) => setTimeout(r, 1100));
}
window.__routen = out;
console.log(Object.entries(out).map(([k, v]) => `Tag ${k}: ${v.km} km`).join("\n"));
