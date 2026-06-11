# Renate & Chris — Bücher-Website

Statische, datengetriebene Website. **Eine einzige Datenquelle:** `books.json`.
Daraus erzeugt ein kleines Node-Skript die Übersicht und je eine Seite pro Buch.
Kein Framework, keine Laufzeit-Abhängigkeiten.

## Schnellstart (lokal)

```bash
node scripts/build.mjs      # erzeugt /dist
# dann /dist/index.html im Browser öffnen
```

## Projektstruktur

```
books.json                  ← ALLE Buchdaten (die einzige Datei, die du normal pflegst)
src/styles.css              ← Design
src/app.js                  ← Filter (Person / Rolle / Typ) auf der Übersicht
scripts/build.mjs           ← Generator: books.json → /dist
scripts/fetch-prices.mjs    ← holt günstigsten BoD-Preis je Buch
tools/buch-hinzufuegen.html ← Formular: erzeugt neuen books.json-Eintrag
.github/workflows/update-prices.yml ← aktualisiert Preise automatisch (wöchentlich)
dist/                       ← Build-Ergebnis (wird von Cloudflare ausgeliefert)
```

## Ein neues Buch hinzufügen

**Variante A – Formular (am einfachsten):**
`tools/buch-hinzufuegen.html` im Browser öffnen, ausfüllen, „Eintrag erzeugen“.
Den JSON-Block in `books.json` in das `books`-Array einfügen. Fertig.
(Optional: bestehende `books.json` im Formular laden und die fertige Datei herunterladen.)

**Variante B – direkt:** einen Objekt-Eintrag in `books.json` ergänzen.

Danach `node scripts/build.mjs` (oder einfach committen — Cloudflare baut automatisch).

## Preise (automatisch von BoD)

Im `price`-Feld steht der günstigste Preis = der BoD-Preis.
`scripts/fetch-prices.mjs` liest die `bodUrl` jedes Buchs und aktualisiert `price`.
Die GitHub Action `update-prices.yml` macht das **wöchentlich automatisch** und committet —
das löst dann den Cloudflare-Rebuild aus. Manuell: Actions-Tab → „Update BoD-Preise“ → Run.

## Deployment: GitHub + Cloudflare Pages

1. Repo zu GitHub pushen.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → dein Repo.
3. Build-Einstellungen:
   - **Framework preset:** None
   - **Build command:** `node scripts/build.mjs`
   - **Build output directory:** `dist`
4. **Save and Deploy.**
5. Custom Domain `renateundchris.com` unter **Custom domains** verbinden.

Ab dann: jeder Commit → automatischer Build & Deploy.

## Newsletter (EmailOctopus)

Das Anmeldeformular steht in `scripts/build.mjs` (Funktion `newsletter`).
`site.newsletterAction` in `books.json` auf die Action-URL deiner EmailOctopus-Liste setzen
und die Feldnamen ggf. an deinen Embed-Code anpassen. Pro Seite wird automatisch ein
verstecktes `tag`-Feld gesetzt (z. B. `bildband-seensuechtig`), damit du später segmentieren kannst.

## Cover

Aktuell werden die Cover von den bestehenden Wix-URLs geladen. Empfehlung: die Bilder
nach `dist`/in einen `assets/`-Ordner übernehmen und in `books.json` lokal verlinken,
damit die Seite unabhängig von Wix ist. Fehlt ein Cover, zeigt die Seite automatisch
eine farbige Ersatzfläche mit dem Titel.
