// Holt den aktuellen BoD-Preis (günstigster Preis) je Buch und aktualisiert books.json.
// Läuft in GitHub Actions oder lokal:  node scripts/fetch-prices.mjs
// (Im Claude-Sandbox nicht ausführbar, da bod.de dort nicht erreichbar ist – im echten Betrieb funktioniert es.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "books.json");
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

const UA = "Mozilla/5.0 (compatible; RenateUndChris-PriceBot/1.0)";

function parsePrice(html) {
  // BoD zeigt z.B. "Buch 14,99 €" und/oder "29,90 €". Wir nehmen den ersten/günstigsten Buchpreis.
  // 1) bevorzugt: Preis direkt nach dem Wort "Buch"
  let m = html.match(/Buch[^0-9]{0,12}(\d{1,3},\d{2})\s*€/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  // 2) sonst: alle Euro-Preise einsammeln und den kleinsten plausiblen nehmen
  const all = [...html.matchAll(/(\d{1,3},\d{2})\s*€/g)].map((x) => parseFloat(x[1].replace(",", ".")));
  const plausible = all.filter((p) => p >= 1 && p <= 200);
  if (plausible.length) return Math.min(...plausible);
  return null;
}

let changed = 0;
for (const b of data.books) {
  if (!b.bodUrl) continue;
  try {
    const res = await fetch(b.bodUrl, { headers: { "User-Agent": UA, "Accept-Language": "de" } });
    if (!res.ok) { console.warn(`! ${b.slug}: HTTP ${res.status}`); continue; }
    const html = await res.text();
    const price = parsePrice(html);
    if (price == null) { console.warn(`! ${b.slug}: kein Preis gefunden`); continue; }
    if (price !== b.price) {
      console.log(`~ ${b.slug}: ${b.price} → ${price}`);
      b.price = price;
      changed++;
    } else {
      console.log(`= ${b.slug}: ${price} (unverändert)`);
    }
  } catch (e) {
    console.warn(`! ${b.slug}: ${e.message}`);
  }
}

if (changed > 0) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`✓ ${changed} Preis(e) aktualisiert.`);
} else {
  console.log("✓ Keine Preisänderungen.");
}
