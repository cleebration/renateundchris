// Tests „Frag die Reise“ (Auftrag 361): Antwort nie als JSON-Text, Quellen befüllt. Aufruf: node tests/frage.test.mjs
import assert from "node:assert/strict";
import worker, { leseAntwort } from "../src/worker.js";

let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };

t("reines JSON", () => {
  const o = leseAntwort('{"antwort": "Am heißesten war es in Ulcinj (Tag 16).", "quellen": [{"reise": "balkan-2026", "tag": 16}]}');
  assert.equal(o.antwort, "Am heißesten war es in Ulcinj (Tag 16).");
  assert.deepEqual(o.quellen, [{ reise: "balkan-2026", tag: 16 }]);
});
t("JSON im Codeblock mit Text davor", () => {
  const o = leseAntwort('Hier die Antwort:\n```json\n{"antwort": "Tag 16 war heiß.", "quellen": [{"reise": "balkan-2026", "tag": 16}]}\n```');
  assert.equal(o.antwort, "Tag 16 war heiß."); assert.equal(o.quellen.length, 1);
});
t("abgeschnitten (Befund 22.11. 00:35)", () => {
  const o = leseAntwort('```json\n{"antwort": "Am heißesten war es am 4. August 2026 auf unserer Reise', "max_tokens");
  assert.ok(!o.antwort.includes("{") && !o.antwort.includes('"antwort"'), o.antwort);
  assert.ok(o.antwort.startsWith("Am heißesten war es am 4. August 2026"));
  assert.ok(o.antwort.endsWith("…"));
});
t("abgeschnitten nach antwort, quellen teilweise", () => {
  const o = leseAntwort('{"antwort": "In Ulcinj, Tag 16.", "quellen": [{"reise": "balkan-2026", "tag": 16}, {"reise": "balk');
  assert.equal(o.antwort, "In Ulcinj, Tag 16."); assert.deepEqual(o.quellen, [{ reise: "balkan-2026", tag: 16 }]);
});
t("Klartext ohne JSON", () => { assert.equal(leseAntwort("Dazu haben wir nichts aufgeschrieben.").antwort, "Dazu haben wir nichts aufgeschrieben."); });
t("Anführungszeichen im Text", () => { assert.equal(leseAntwort('{"antwort": "Das \\"Meer\\" war warm.", "quellen": []}').antwort, 'Das "Meer" war warm.'); });

// Ende-zu-Ende mit Attrappen: Worker liefert ganze Antwort + Quelle, auch wenn das Modell abgeschnittenes JSON schickt
const wissen = [{ reise: "balkan-2026", titel: "Balkan 2026", tage: [
  { tag: 15, datum: "2026-08-03", land: "ME", titel: "Budva", fakten: "32 °C", text: "Heiß in Budva." },
  { tag: 16, datum: "2026-08-04", land: "ME", titel: "Ulcinj", fakten: "38 °C, heißester Tag", text: "In Ulcinj war es am heißesten, 38 Grad." } ] }];
const kv = new Map();
const env = {
  ANTHROPIC_API_KEY: "x",
  FRAGE: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } },
  ASSETS: { fetch: async () => new Response(JSON.stringify(wissen), { headers: { "content-type": "application/json" } }) },
};
const echt = globalThis.fetch;
async function frag(modellText, stop = "end_turn") {
  let gesendet;
  globalThis.fetch = async (u, init) => { gesendet = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: "text", text: modellText }], stop_reason: stop, usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 }); };
  try {
    const r = await worker.fetch(new Request("https://renateundchris.com/api/frage", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" }, body: JSON.stringify({ frage: "Wo war es am heißesten?", reise: "balkan-2026" }) }), env);
    return { status: r.status, body: await r.json(), gesendet };
  } finally { globalThis.fetch = echt; }
}
{
  const a = await frag('```json\n{"antwort": "Am heißesten war es in Ulcinj an Tag 16 mit 38 Grad.", "quellen": [{"reise": "balkan-2026", "tag": 16}]}\n```');
  assert.equal(a.status, 200); assert.equal(a.body.antwort, "Am heißesten war es in Ulcinj an Tag 16 mit 38 Grad.");
  assert.deepEqual(a.body.quellen, [{ reise: "balkan-2026", titelReise: "Balkan 2026", tag: 16, titel: "Ulcinj" }]);
  assert.ok(a.gesendet.max_tokens >= 1000); n++; console.log("ok Worker: Codeblock-JSON");
}
{
  const a = await frag('{"antwort": "Am heißesten war es an Tag 16 in Ulcinj', "max_tokens");
  assert.equal(a.status, 200); assert.ok(!a.body.antwort.includes("{"));
  assert.deepEqual(a.body.quellen.map((q) => q.tag), [16]); n++; console.log("ok Worker: abgeschnitten → Quelle aus „Tag 16“");
}
console.log(`${n} Tests grün`);
