#!/usr/bin/env bash
# The trailer, start to finish, on the GPU box. Runs unattended inside an
# srjob job started by send_trailer.sh; nothing in it needs a person.
#
#   bash blender/trailer_job.sh                     every shot, the capture, then the cut
#   PREVIEW=48 bash blender/trailer_job.sh          one frame of each shot, nothing else
#   PREVIEW=1,48 PREVIEW_SHOT=t03-hall ...          those frames of one shot
#   SCORE=preview bash blender/trailer_job.sh       only the trailer's own score, and the finished
#                                                   film with it laid under, to listen to
#   SCORE=voiceover bash blender/trailer_job.sh     the same, with the grandmother's voiceover over it
#   SCORE=1 bash blender/trailer_job.sh             the whole film, scored with it
#   SCORE=voiceover-film bash blender/trailer_job.sh  the whole film with the score and the voiceover
#
# Run from the synced render folder (~/morrowlamp-render). Frames already
# rendered are kept, so running it again resumes. Output: out/trailer/
# sunken-crown-trailer.mp4 and thumbnail.jpg (docs/remastered/trailer-plan.md).
set -euo pipefail

cd "${MORROW_RENDER_DIR:-$HOME/morrowlamp-render}"
BLENDER="${MORROW_BLENDER:-$HOME/opt/blender-5.3/blender}"
OUT=out/trailer
SHOTS=(art/blender/trailer/*.blend)
[ -e "${SHOTS[0]}" ] || { echo "no shots in art/blender/trailer"; exit 1; }
frames_of() { python3 -c "import sys; sys.path.insert(0, 'blender/trailer'); import shots; print(shots.by_id('$1')['frames'])"; }

if [ "${SCORE:-}" = preview ] || [ "${SCORE:-}" = voiceover ]; then
  node tools/trailer/capture.mjs "$OUT" --score-only
  if [ "$SCORE" = voiceover ]; then
    export PATH="$HOME/.local/bin:$PATH"
    python3 tools/trailer/voiceover.py "$OUT"
    python3 tools/trailer/cut.py "$OUT" --voiceover-preview
  else
    python3 tools/trailer/cut.py "$OUT" --score-preview
  fi
  exit 0
fi

if [ -n "${PREVIEW:-}" ]; then
  for blend in "${SHOTS[@]}"; do
    shot="$(basename "$blend" .blend)"
    [ -z "${PREVIEW_SHOT:-}" ] || [ "$shot" = "$PREVIEW_SHOT" ] || continue
    want="$PREVIEW"; [ "$(frames_of "$shot")" -gt 1 ] || want=1
    "$BLENDER" -b "$blend" --python-exit-code 1 -P blender/render_epilogue.py -- \
      --out "out/trailer-preview/$shot" --frames "$want" 2>&1 | grep -E '\[morrow\]|Error|Traceback'
  done
  echo "[morrow] preview done"
  exit 0
fi

for blend in "${SHOTS[@]}"; do
  shot="$(basename "$blend" .blend)"
  frames=$(frames_of "$shot")
  mkdir -p "$OUT/shots/$shot"
  have=$(find "$OUT/shots/$shot" -name '*.png' -size +1k | wc -l)
  if [ "$have" -ge "$frames" ]; then echo "[morrow] $shot: all $frames frames already rendered"; continue; fi
  find "$OUT/shots/$shot" -name '*.png' -size -1k -delete
  echo "[morrow] $shot: rendering ($have of $frames on disk)"
  if [ "$frames" -eq 1 ]; then
    "$BLENDER" -b "$blend" --python-exit-code 1 -P blender/render_epilogue.py -- --out "$OUT/shots/$shot" --frames 1 2>&1 \
      | grep -E '\[morrow\]|Error|Traceback' || true
  else
    "$BLENDER" -b "$blend" --python-exit-code 1 -P blender/render_epilogue.py -- --out "$OUT/shots/$shot" 2>&1 \
      | grep -E '\[morrow\]|Error|Traceback' || true
  fi
  done_now=$(find "$OUT/shots/$shot" -name '*.png' -size +1k | wc -l)
  [ "$done_now" -ge "$frames" ] || { echo "[morrow] $shot: only $done_now of $frames frames"; exit 1; }
done

# The music cues, the EGA frame and the title cards, in headless Chromium.
node tools/trailer/capture.mjs "$OUT"
# The edit, the mix and the thumbnail.
if [ "${SCORE:-}" = voiceover-film ]; then
  export PATH="$HOME/.local/bin:$PATH"
  # Her takes are kept between cuts; REVOICE=1 records them again.
  if [ -n "${REVOICE:-}" ] || [ ! -s "$OUT/audio/voiceover.wav" ]; then python3 tools/trailer/voiceover.py "$OUT"; fi
  python3 tools/trailer/cut.py "$OUT" --voiceover
else
  python3 tools/trailer/cut.py "$OUT" ${SCORE:+--score}
fi
