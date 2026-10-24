# Teaser-Video je Reise (35 s)

Erzeugt automatisch aus den Atlas-Daten: Titelbild → Route zeichnet sich über die Karte (Natural Earth, world-atlas) mit Fotos vom jeweiligen Tag → Zahlen → „Die ganze Reise erkunden“ + Link. Quer (16:9) für die Website, hochkant (9:16) für WhatsApp/Instagram/Shorts. Ohne Ton.

Ablauf (braucht Node, Python mit Playwright/Chromium, ffmpeg):

    node scripts/build.mjs                       # dist/ mit Atlas-Daten und Fotos
    mkdir -p /tmp/teaser && cp tools/teaser/* /tmp/teaser && cd /tmp/teaser
    npm init -y && npm i world-atlas@2 topojson-client@3 @fontsource/big-shoulders-display @fontsource/ibm-plex-mono @fontsource/source-serif-4
    ln -s <repo>/dist dist && python3 -m http.server 8790 &
    python3 render.py <reise> 1920 1080 teaser-16x9.mp4
    python3 render.py <reise> 1080 1920 teaser-9x16.mp4
    cp teaser-*.mp4 <repo>/assets/reisen/<reise>/

Sobald die Dateien in assets/reisen/<reise>/ liegen, zeigen Weltkugel und Atlas den Knopf „▶ Teaser“.
