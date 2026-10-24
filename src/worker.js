// renateundchris.com – Worker: liefert die statische Seite (dist/) und beantwortet „Die Reise fragen“ unter /api/frage.
//
// POST /api/frage  { frage: "…", reise: "<slug>" | "" }  →  { antwort, quellen: [{ reise, titelReise, tag, titel }] }
// Antworten nur aus /atlas/data/wissen.json (Tagebuch, Stationen, Fakten, Querbezüge). Modell: Claude (Anthropic API).
// Geheimnis: ANTHROPIC_API_KEY (wrangler secret put ANTHROPIC_API_KEY). Zähler: KV-Bindung FRAGE.
// Schutz: Frage max. 300 Zeichen · 15 Fragen je Gerät und Tag · 200 Fragen je Tag gesamt · Monatsbudget (BUDGET_USD, Standard 5,40 USD ≈ 5 €).
// Kosten je Frage werden aus der Token-Zahl der Antwort geschätzt (PREIS_IN_USD / PREIS_OUT_USD je Million Token, als Variablen setzbar).

const MODELL = "claude-haiku-5-5";
const STOPP = new Set("der die das und oder ein eine einer eines wo wie was wann wer welche welcher welches war waren ist sind wir ihr habt hat haben am im in an auf mit von zu zum zur den dem des es gab gibt euch uns man auch noch nur sehr mal".split(" "));
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/frage") return env.ASSETS.fetch(req);
    if (req.method !== "POST") return json({ fehler: "Nur POST" }, 405);
    if (!env.ANTHROPIC_API_KEY) return json({ fehler: "Die Fragefunktion ist noch nicht eingerichtet." }, 503);

    let body; try { body = await req.json(); } catch (e) { return json({ fehler: "Ungültige Anfrage" }, 400); }
    const frage = String(body.frage || "").trim().slice(0, 300);
    const reise = String(body.reise || "").replace(/[^a-z0-9-]/g, "");
    if (frage.length < 3) return json({ fehler: "Bitte eine Frage eingeben." }, 400);

    // Grenzen (KV, nicht exakt, reicht als Bremse)
    const heute = new Date().toISOString().slice(0, 10), monat = heute.slice(0, 7);
    const ip = req.headers.get("cf-connecting-ip") || "x";
    const ipHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + heute)))].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
    const kv = env.FRAGE;
    const zahl = async (k) => +(kv ? (await kv.get(k)) || 0 : 0);
    const budget = +(env.BUDGET_USD || 5.4);
    const [nIp, nTag, kosten] = await Promise.all([zahl(`ip:${ipHash}`), zahl(`tag:${heute}`), zahl(`usd:${monat}`)]);
    if (kosten >= budget) return json({ fehler: "Das Frage-Budget für diesen Monat ist aufgebraucht. Nächsten Monat geht es weiter." }, 429);
    if (nTag >= 200) return json({ fehler: "Heute wurden schon sehr viele Fragen gestellt. Morgen wieder!" }, 429);
    if (nIp >= 15) return json({ fehler: "Du hast heute schon 15 Fragen gestellt. Morgen wieder!" }, 429);

    // Wissen laden und passende Tage suchen
    const w = await env.ASSETS.fetch(new Request(new URL("/atlas/data/wissen.json", url))).then((r) => r.json());
    const fn = norm(frage);
    const nennt = w.filter((r) => norm(r.titel).split(/\s+/).some((t) => t.length > 3 && !/^\d+$/.test(t) && fn.includes(t)));
    const alleReisen = /alle|insgesamt|welche reise|unsere reisen|jemals|uberhaupt/.test(fn);
    const auswahl = nennt.length ? nennt : alleReisen || !reise ? w : w.filter((r) => r.reise === reise);
    const woerter = fn.split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOPP.has(t));
    const tage = auswahl.flatMap((r) => r.tage.map((d) => ({ r, d, s: woerter.reduce((a, t) => a + (norm(d.titel + " " + d.text).includes(t) ? 1 : 0), 0) })));
    const top = tage.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8);
    const fakten = auswahl.map((r) => `## ${r.titel} (${r.reise}${r.fahrzeug ? ", " + r.fahrzeug : ""})\n` + r.tage.map((d) => `Tag ${d.tag} · ${d.datum} · ${d.land} · ${d.titel} · ${d.fakten}`).join("\n")).join("\n\n");
    const auszuege = top.map((x) => `### ${x.r.titel} · Tag ${x.d.tag} (${x.d.datum}) · ${x.d.titel}\n${x.d.text}`).join("\n\n");

    const system = `Du beantwortest Fragen zu den Reisen von Renate und Chris auf ihrer Website renateundchris.com.
Regeln:
- Antworte auf Deutsch, freundlich, in höchstens 4 Sätzen.
- Verwende ausschließlich die Angaben unten (Faktenliste und Auszüge). Erfinde nichts, schätze nichts dazu.
- Steht die Antwort nicht in den Angaben, sag ehrlich: „Dazu haben wir nichts aufgeschrieben.“
- Nenne die Tage, auf die du dich stützt.
- Gib die Antwort als JSON zurück: {"antwort": "...", "quellen": [{"reise": "<slug>", "tag": <Zahl>}]}. Nur JSON, kein weiterer Text.`;
    const nutzer = `FAKTEN JE TAG:\n${fakten}\n\nAUSZÜGE AUS DEM TAGEBUCH:\n${auszuege || "(keine passenden Auszüge gefunden)"}\n\nFRAGE: ${frage}`;

    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: env.MODELL || MODELL, max_tokens: 500, system, messages: [{ role: "user", content: nutzer }] }),
      });
    } catch (e) { return json({ fehler: "Der Sprachdienst ist gerade nicht erreichbar." }, 502); }
    if (!r.ok) return json({ fehler: `Der Sprachdienst antwortet nicht (${r.status}).` }, 502);
    const a = await r.json();
    const text = (a.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();

    // Zähler und geschätzte Kosten
    const u = a.usage || {};
    const usd = ((u.input_tokens || 0) * +(env.PREIS_IN_USD || 1) + (u.output_tokens || 0) * +(env.PREIS_OUT_USD || 5)) / 1e6;
    if (kv) await Promise.all([
      kv.put(`ip:${ipHash}`, String(nIp + 1), { expirationTtl: 90000 }),
      kv.put(`tag:${heute}`, String(nTag + 1), { expirationTtl: 90000 }),
      kv.put(`usd:${monat}`, String(Math.round((kosten + usd) * 1e6) / 1e6), { expirationTtl: 40 * 86400 }),
    ]);

    let out; try { out = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()); } catch (e) { out = { antwort: text, quellen: [] }; }
    const quellen = (Array.isArray(out.quellen) ? out.quellen : []).map((q) => {
      const rr = w.find((x) => x.reise === q.reise); const d = rr && rr.tage.find((t) => t.tag === +q.tag);
      return rr && d ? { reise: rr.reise, titelReise: rr.titel, tag: d.tag, titel: d.titel } : null;
    }).filter(Boolean).slice(0, 6);
    return json({ antwort: String(out.antwort || "Dazu haben wir nichts aufgeschrieben."), quellen });
  },
};
