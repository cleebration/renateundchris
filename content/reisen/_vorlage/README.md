# Vorlage: neue Reise im Reise-Atlas

Der Atlas ist für jede Reise derselbe. Eine neue Reise braucht nur **Daten** und **Fotos**,
keinen neuen Code. Ergebnis: `renateundchris.com/atlas/<reise>/` mit 3D-Karte, Zeitleiste,
Rollen, Fotos und iPhone-Controller.

## Ablage in „1! claude“ (Drive)

Rohdaten einer Reise (Fotos-web, Kontaktbögen, Stationen, Log) liegen unter
`05 Projekte/Travel <Jahr> <Reise>/`; `05 Projekte/Tool Reise-Atlas/` hat nur Konzept und Werkzeug.
Die Foto-Werkzeuge brauchen dafür `ZIEL=<Travel-Ordner>/Input/Fotos-web`.

## 1. Reise anlegen

1. In `reisen.json` oben einen Eintrag ergänzen (Reihenfolge egal: /reisen und /atlas/ sortieren automatisch nach Startdatum, neueste zuerst):
   ```json
   { "slug": "italien-2027", "title": "Italien 2027", "zeitraum": "Juli 2027",
     "laender": ["Italien"], "blurb": "Ein Satz zur Reise.", "fahrzeug": "ein Campervan",
     "cover": "", "accent": "#1f6f74", "accentInk": "#0f4a4e", "wash": "#dde9e7" }
   ```
2. Ordner `content/reisen/<slug>/` anlegen und die drei Dateien aus diesem Ordner hineinkopieren:
   `_atlas.json`, `_routen.json`, `_fotos.json`. Überall `SLUG-DER-REISE` ersetzen.

Sobald `_atlas.json` existiert, baut der Build `/atlas/<slug>/`, verlinkt die Reise auf `/reisen`
und leitet `/reise/<slug>/` in den Atlas um.

## 2. Tage und Stationen (`_atlas.json`)

Ein Eintrag pro Reisetag. Pflicht: `tag`, `datum`, `land` (ISO-2, z. B. `IT`), `stationen` mit
`name`, `lat`, `lon`, `art`. Alles andere füllt die Tiefe:

| Feld | Wofür |
|---|---|
| `titel`, `satz` | Tiefe 1 |
| `teaser` | Tiefe 2 |
| `mythen`, `wien_faden`, Stationsliste | Tiefe 3 |
| `themen` | Themenfilter: geschichte, habsburg, mythencheck, kulinarik, kloster, burg, natur, strand, grenze, panne, eisenbahn, faehre |
| `art` je Station | besuch, uebernachtung, essen, grenze, faehre, panne, aussicht |
| `status` | voll, teilweise, nur-fotos, fehlt (fehlt = schraffiert in der Zeitleiste) |

Am schnellsten: Claude aus den Tagebuchdateien extrahieren lassen (Prompt in
`1! claude/04 Templates/Reise-Atlas/Prompt Stationen extrahieren.md`).
Länder außerhalb der Liste in `src/atlas.js` (`COUNTRY`) dort ergänzen.

## 3. Straßenrouten (`_routen.json`)

`tools/atlas-routen.js` in der Browser-Konsole auf `router.project-osrm.org` ausführen
(Anleitung im Kopf der Datei). Tage ohne Route zeigt der Atlas ohne Linie.

## 4. Fotos (`_fotos.json`)

1. Alben in Google Fotos je Tag (Name mit Tagesnummer).
2. Je Album „Alle herunterladen“, dann am Mac `album.sh <ordner> "<Albumtext>"` – verkleinert,
   liest Zeit und GPS, löscht nur dieses Zip (Werkzeuge in `1! claude/04 Templates/Reise-Atlas/`).
3. `auswahl.py` wählt je Tag bis 14 Fotos (je Moment das schärfste); Kontaktbögen ansehen,
   Unpassendes streichen (Texturen, Infotafeln, Passwörter, Dokumente, Doppelte).
4. Fotos (1280 px) nach `assets/reisen/<slug>/atlas/tag-XX/`, Liste nach `_fotos.json`:
   `{"tage": {"2": [{"datei": "IMG_1.jpg", "zeit": "14:32", "lat": 43.7, "lon": 15.9, "gps": "exakt", "hoch": false}]}}`

## 5. Veröffentlichen

`node scripts/build.mjs` lokal prüfen, committen, pushen – Cloudflare baut automatisch.
Test: `/atlas/<slug>/` am Mac öffnen, QR mit dem iPhone scannen.

## Technik in Kürze

- Karte: MapLibre GL, OpenFreeMap (Liberty), Höhen: Terrain Tiles (AWS Open Data)
- iPhone ↔ Bildschirm: MQTT über öffentliche Broker (EMQX, HiveMQ), Kanal `rcatlas/v1/<code>/…`
- Code: `scripts/atlas.mjs` (Build), `src/atlas.js`, `src/atlas.css`
