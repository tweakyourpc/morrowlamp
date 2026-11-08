#!/usr/bin/env bash
# The epilogue film, start to finish, on the GPU box. Runs unattended inside
# an srjob job started by send_epilogue.sh; nothing in it needs a person.
#
#   bash blender/epilogue_job.sh            every frame of every shot, then the film
#   PREVIEW=72 bash blender/epilogue_job.sh one frame of each shot, no film
#   PREVIEW=1,72,144 PREVIEW_SHOT=03-hall ... those frames of one shot
#
# Run from the synced render folder (~/morrowlamp-render). Frames already
# rendered are kept, so running it again resumes a job that stopped.
# Output: out/epilogue/epilogue.mp4 and out/epilogue/poster.jpg.
set -euo pipefail

cd "${MORROW_RENDER_DIR:-$HOME/morrowlamp-render}"
BLENDER="${MORROW_BLENDER:-$HOME/opt/blender-5.3/blender}"
FPS=24
SECONDS_EACH=6
DISSOLVE=0.75
OUT=out/epilogue
SHOTS=(art/blender/epilogue/*.blend)
[ -e "${SHOTS[0]}" ] || { echo "no shots in art/blender/epilogue"; exit 1; }

if [ -n "${PREVIEW:-}" ]; then
  for blend in "${SHOTS[@]}"; do
    shot="$(basename "$blend" .blend)"
    [ -z "${PREVIEW_SHOT:-}" ] || [ "$shot" = "$PREVIEW_SHOT" ] || continue
    "$BLENDER" -b "$blend" --python-exit-code 1 -P blender/render_epilogue.py -- \
      --out "out/epilogue-preview/$shot" --frames "$PREVIEW" 2>&1 | grep -E '\[morrow\]|Error|Traceback'
  done
  echo "[morrow] preview done"
  exit 0
fi

frames=$((FPS * SECONDS_EACH))
for blend in "${SHOTS[@]}"; do
  shot="$(basename "$blend" .blend)"
  mkdir -p "$OUT/$shot"
  have=$(find "$OUT/$shot" -name '*.png' -size +1k | wc -l)
  if [ "$have" -ge "$frames" ]; then
    echo "[morrow] $shot: all $frames frames already rendered"
    continue
  fi
  # A placeholder from a run that was stopped mid-frame is empty: clear it so the frame is redone.
  find "$OUT/$shot" -name '*.png' -size -1k -delete
  echo "[morrow] $shot: rendering ($have of $frames on disk)"
  "$BLENDER" -b "$blend" --python-exit-code 1 -P blender/render_epilogue.py -- --out "$OUT/$shot" 2>&1 \
    | grep -E '\[morrow\]|Error|Traceback' || true
  done_now=$(find "$OUT/$shot" -name '*.png' -size +1k | wc -l)
  [ "$done_now" -ge "$frames" ] || { echo "[morrow] $shot: only $done_now of $frames frames"; exit 1; }
done

# ---------------------------------------------------------------- the cut
# Each shot to a clip, then dissolves between them, a fade in and a fade out.
inputs=()
for blend in "${SHOTS[@]}"; do
  shot="$(basename "$blend" .blend)"
  ffmpeg -y -loglevel error -framerate "$FPS" -i "$OUT/$shot/%04d.png" -c:v libx264 -crf 14 -preset fast -pix_fmt yuv420p "$OUT/$shot.mp4"
  inputs+=(-i "$OUT/$shot.mp4")
done
n=${#SHOTS[@]}
graph=""
prev="[0:v]"
for ((k = 1; k < n; k++)); do
  offset=$(awk -v k="$k" -v s="$SECONDS_EACH" -v d="$DISSOLVE" 'BEGIN { printf "%.3f", k * (s - d) }')
  graph+="${prev}[$k:v]xfade=transition=fade:duration=$DISSOLVE:offset=$offset[x$k];"
  prev="[x$k]"
done
total=$(awk -v n="$n" -v s="$SECONDS_EACH" -v d="$DISSOLVE" 'BEGIN { printf "%.3f", n * s - (n - 1) * d }')
fade_out=$(awk -v t="$total" 'BEGIN { printf "%.3f", t - 1.2 }')
graph+="${prev}fade=t=in:st=0:d=0.8,fade=t=out:st=$fade_out:d=1.2,format=yuv420p[film]"
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$graph" -map "[film]" \
  -c:v libx264 -crf 23 -preset slow -profile:v high -movflags +faststart -an "$OUT/epilogue.mp4"
ffmpeg -y -loglevel error -ss 14 -i "$OUT/epilogue.mp4" -frames:v 1 -q:v 3 "$OUT/poster.jpg"
echo "[morrow] film: $OUT/epilogue.mp4 (${total}s, $(du -h "$OUT/epilogue.mp4" | cut -f1)) and $OUT/poster.jpg"
