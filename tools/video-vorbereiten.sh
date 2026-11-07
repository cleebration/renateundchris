#!/bin/bash
# Reise-Atlas: ein Video für R2 vorbereiten (MP4/H.264/AAC, max. 1080p, faststart) + Vorschaubild.
#   tools/video-vorbereiten.sh <reise-slug> <tag> <eingabe.mov|mp4> <kurzname> ["Beschriftung"]
# Ergebnis: _video-upload/<reise>/tag-NN-<kurzname>.mp4 (für R2, NICHT ins Repo)
#           assets/reisen/<reise>/videos/tag-NN-<kurzname>.jpg (Vorschaubild, ins Repo)
#           Zeile für content/reisen/<reise>/_videos.json wird ausgegeben.
# Braucht ffmpeg + ffprobe. Grenze: 200 MB je Video (sonst kürzer schneiden oder CRF erhöhen).
set -euo pipefail
REISE="$1"; TAG="$2"; IN="$3"; NAME="$4"; TEXT="${5:-}"
[[ "$REISE" =~ ^[a-z0-9-]+$ ]] || { echo "Reise-Slug ungültig"; exit 1; }
[[ "$NAME" =~ ^[a-z0-9-]+$ ]] || { echo "Kurzname nur a-z 0-9 -"; exit 1; }
NN=$(printf "%02d" "$TAG"); DATEI="tag-$NN-$NAME.mp4"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/_video-upload/$REISE"; POS="$ROOT/assets/reisen/$REISE/videos"; mkdir -p "$OUT" "$POS"
ffmpeg -nostdin -y -i "$IN" -map 0:v:0 -map 0:a:0? -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf 23 \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2" \
  -c:a aac -b:a 128k -ac 2 -movflags +faststart -map_metadata -1 "$OUT/$DATEI"
ffmpeg -nostdin -y -ss 1 -i "$OUT/$DATEI" -frames:v 1 -vf "scale='min(1280,iw)':-2" -q:v 4 "$POS/${DATEI%.mp4}.jpg"
MB=$(( ($(stat -f%z "$OUT/$DATEI" 2>/dev/null || stat -c%s "$OUT/$DATEI") + 1048575) / 1048576 ))
DAUER=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$DATEI" | cut -d. -f1)
[ "$MB" -le 200 ] || { echo "ZU GROSS: $MB MB (Grenze 200 MB)"; exit 1; }
echo "Fertig: $OUT/$DATEI ($MB MB, ${DAUER}s)"
echo "Hochladen:  npx wrangler r2 object put renateundchris-videos/$REISE/$DATEI --file \"$OUT/$DATEI\" --content-type video/mp4 --jurisdiction eu --remote"
echo "In content/reisen/$REISE/_videos.json unter \"$TAG\" eintragen:"
echo "  { \"datei\": \"$DATEI\", \"text\": \"$TEXT\", \"dauer\": $DAUER, \"mb\": $MB }"
