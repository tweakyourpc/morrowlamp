#!/usr/bin/env bash
# Send the trailer to the GPU box, check on it, and bring it home (docs/remastered/trailer-plan.md).
#
#   tools/blender/send_trailer.sh --preview [SHOT [FRAMES]]   frame 48 of each shot (or FRAMES of SHOT), fetched to build/trailer-preview/
#   tools/blender/send_trailer.sh             build every shot and start the whole film as one srjob job (fresh)
#   tools/blender/send_trailer.sh --resume    start it again, keeping the frames already rendered
#   tools/blender/send_trailer.sh --redo SHOT...  render those shots again (e.g. t03-hall thumb) and re-cut the film
#   tools/blender/send_trailer.sh --status    how the last job is doing
#   tools/blender/send_trailer.sh --fetch     copy the trailer and thumbnail into marketing/trailer/
#   tools/blender/send_trailer.sh --score     render the trailer's own score on its own and under the
#                                             finished film, and fetch both to marketing/trailer/
#   tools/blender/send_trailer.sh --voiceover the same, with the grandmother's voiceover over the score
#   tools/blender/send_trailer.sh --voiceover-film  re-cut the whole film (cards and all) with the score
#                                             and the voiceover, as sunken-crown-trailer-voiceover.mp4
#
# Building the .blend files happens here (seconds, no rendering); every
# frame is rendered on $MORROW_HOST's GPU. The job runs detached in srjob,
# so it survives this terminal closing; it needs nobody once it has started.
set -euo pipefail

HOST="${MORROW_HOST:-showrig-worker}"
REMOTE="${MORROW_REMOTE_DIR:-morrowlamp-render}"
SRJOB="${MORROW_SRJOB:-\$HOME/showrig-worker/bin/srjob}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAST="$ROOT/build/trailer-job"
FONTS="${MORROW_FONTS:-$ROOT/build/fonts}"
cd "$ROOT"

build_and_sync() {
  # The fonts live outside the repository; gather them from the usual places.
  mkdir -p "$FONTS"
  for f in CormorantGaramond-Bold CormorantGaramond-SemiBold EBGaramond-Regular EBGaramond-SemiBold; do
    [ -e "$FONTS/$f.ttf" ] || cp "$(ls ~/.local/share/fonts/$f.ttf ~/.fonts/$f.ttf 2>/dev/null | head -1)" "$FONTS/"
  done
  local ids
  ids=$(python3 -c "import sys; sys.path.insert(0, 'tools/blender/trailer'); import shots; print(' '.join(s['id'] for s in shots.SHOTS))")
  rm -rf art/blender/trailer
  for id in $ids; do
    blender -b --factory-startup --python-exit-code 1 -P tools/blender/build_trailer.py -- "$id" | grep -E '^built|Error|Traceback'
  done
  rsync -a --delete --exclude __pycache__ tools/blender "$HOST:$REMOTE/"
  rsync -a --delete art/blender/trailer "$HOST:$REMOTE/art/blender/"
  # The capture renders the game's own score and EGA painter, and the cards' fonts (SIL OFL).
  ssh "$HOST" "mkdir -p $REMOTE/tools $REMOTE/fonts"
  rsync -a --delete js "$HOST:$REMOTE/"
  rsync -a --delete tools/trailer "$HOST:$REMOTE/tools/"
  rsync -a "$FONTS/CormorantGaramond-Bold.ttf" "$FONTS/CormorantGaramond-SemiBold.ttf" "$FONTS/EBGaramond-Regular.ttf" \
    "$FONTS/EBGaramond-SemiBold.ttf" "$HOST:$REMOTE/fonts/"
}

case "${1:-}" in
  --status)
    job="$(cat "$LAST" 2>/dev/null)" || { echo "no job started from here yet"; exit 1; }
    ssh "$HOST" "$SRJOB status $job; $SRJOB log $job | tail -n 5"
    ;;
  --fetch)
    mkdir -p marketing/trailer
    rsync -a "$HOST:$REMOTE/out/trailer/sunken-crown-trailer.mp4" "$HOST:$REMOTE/out/trailer/thumbnail.jpg" marketing/trailer/
    ls -l marketing/trailer
    ;;
  --score|--voiceover)
    # Only the music, the voice and what renders them; the shots and the film are already there.
    rsync -a --delete js "$HOST:$REMOTE/"
    rsync -a --delete --exclude __pycache__ tools/trailer tools/voice "$HOST:$REMOTE/tools/"
    rsync -a --delete --exclude __pycache__ tools/blender "$HOST:$REMOTE/"
    mode=preview; files="trailer-score.m4a sunken-crown-trailer-scored-preview.mp4"
    if [ "$1" = --voiceover ]; then
      mode=voiceover; files="trailer-score-voiceover.m4a sunken-crown-trailer-voiceover-preview.mp4"
    fi
    job="trailer-$mode-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "$SRJOB start $job 'SCORE=$mode bash \$HOME/$REMOTE/blender/trailer_job.sh'" >/dev/null
    echo "$mode job $job on $HOST"
    ssh "$HOST" "$SRJOB wait $job" >/dev/null || { ssh "$HOST" "$SRJOB log $job | tail -n 20"; exit 1; }
    ssh "$HOST" "$SRJOB log $job" | grep '\[morrow\]\|error' || true
    mkdir -p marketing/trailer
    for f in $files; do rsync -a "$HOST:$REMOTE/out/trailer/$f" marketing/trailer/; done
    ls -l marketing/trailer
    ;;
  --preview)
    build_and_sync
    job="trailer-preview-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "rm -rf \$HOME/$REMOTE/out/trailer-preview; $SRJOB start $job 'PREVIEW=${3:-48} PREVIEW_SHOT=${2:-} bash \$HOME/$REMOTE/blender/trailer_job.sh'" >/dev/null
    echo "preview job $job on $HOST"
    ssh "$HOST" "$SRJOB wait $job" >/dev/null || { ssh "$HOST" "$SRJOB log $job | tail -n 20"; exit 1; }
    ssh "$HOST" "$SRJOB log $job" | grep '\[morrow\]'
    rm -rf build/trailer-preview && mkdir -p build/trailer-preview
    rsync -a "$HOST:$REMOTE/out/trailer-preview/" build/trailer-preview/
    echo "previews in build/trailer-preview/"
    ;;
  --voiceover-film)
    build_and_sync
    rsync -a --delete --exclude __pycache__ tools/voice "$HOST:$REMOTE/tools/"
    ssh "$HOST" "rm -f \$HOME/$REMOTE/out/trailer/sunken-crown-trailer-voiceover.mp4"
    job="trailer-voiceover-film-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "$SRJOB start $job 'SCORE=voiceover-film bash \$HOME/$REMOTE/blender/trailer_job.sh'" >/dev/null
    echo "film job $job on $HOST"
    ssh "$HOST" "$SRJOB wait $job" >/dev/null || { ssh "$HOST" "$SRJOB log $job | tail -n 20"; exit 1; }
    ssh "$HOST" "$SRJOB log $job" | grep '\[morrow\] \(voiceover\|trailer\)\|error' || true
    mkdir -p marketing/trailer
    rsync -a "$HOST:$REMOTE/out/trailer/sunken-crown-trailer-voiceover.mp4" marketing/trailer/
    ls -l marketing/trailer
    ;;
  ""|--resume|--redo)
    build_and_sync
    case "${1:-}" in
      --resume) ;;
      --redo) [ -n "${2:-}" ] || { echo "--redo needs a shot id, e.g. t03-hall"; exit 1; }
              gone=""; for s in "${@:2}"; do gone="$gone 'shots/$s'"; done
              ssh "$HOST" "cd \$HOME/$REMOTE/out/trailer && rm -rf $gone sunken-crown-trailer.mp4 thumbnail.jpg" ;;
      *) ssh "$HOST" "rm -rf \$HOME/$REMOTE/out/trailer" ;;
    esac
    job="trailer-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "$SRJOB start $job 'bash \$HOME/$REMOTE/blender/trailer_job.sh'" >/dev/null
    mkdir -p build && echo "$job" > "$LAST"
    echo "trailer job $job started on $HOST; check with --status, then --fetch when it is done"
    ;;
  *)
    sed -n '2,19p' "$0"; exit 1 ;;
esac
