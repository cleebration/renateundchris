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

## Musik unterlegen (freie Musik aus content/reisen/_musik.json)

Wikimedia sperrt Abrufe aus Rechenzentren oft (429) – am Mac/in der Mac-VM laden. Danach je Format:

    ffmpeg -i teaser-16x9.mp4 -i musik.mp3 -filter_complex "[0:v]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='Musik: <Titel> – <Urheber>, <Lizenz>, via Wikimedia Commons':fontsize=h/60:fontcolor=white@0.75:x=(w-tw)/2:y=h-th-h/40:enable='gte(t,31.2)'[v];[1:a]atrim=0:35.5,asetpts=N/SR/TB,afade=t=in:st=0:d=0.8,afade=t=out:st=31:d=4.5,loudnorm=I=-18:TP=-2[a]" -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -shortest -movflags +faststart teaser-16x9-musik.mp4

Bei CC-BY/CC-BY-SA-Stücken muss der Nachweis im Video stehen (drawtext oben).
Gewählt 2026-10-24: Balkan = Greek Dance (Jason Shaw, CC BY 3.0) · Cinque Terre = Tarantella (gemeinfrei) · Dubrovnik = Tänze aus der Bela krajina (gemeinfrei).
