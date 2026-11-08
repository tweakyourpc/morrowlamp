#!/usr/bin/env bash
# Send the epilogue film to the GPU box, check on it, and bring it home.
#
#   tools/blender/send_epilogue.sh --preview [SHOT [FRAMES]]   frame 72 of each shot (or FRAMES of SHOT), fetched to build/epilogue-preview/
#   tools/blender/send_epilogue.sh             build every shot and start the whole film as one srjob job (fresh)
#   tools/blender/send_epilogue.sh --resume    start it again, keeping the frames already rendered
#   tools/blender/send_epilogue.sh --redo SHOT...  render those shots again (e.g. 03-hall 07-garden) and re-cut the film
#   tools/blender/send_epilogue.sh --status    how the last job is doing
#   tools/blender/send_epilogue.sh --fetch     copy the finished film into remastered/epilogue/
#
# Building the .blend files happens here (seconds, no rendering); every
# frame is rendered on $MORROW_HOST's GPU. The job runs detached in srjob,
# so it survives this terminal closing; it needs nobody once it has started.
set -euo pipefail

HOST="${MORROW_HOST:-showrig-worker}"
REMOTE="${MORROW_REMOTE_DIR:-morrowlamp-render}"
SRJOB="${MORROW_SRJOB:-\$HOME/showrig-worker/bin/srjob}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAST="$ROOT/build/epilogue-job"
cd "$ROOT"

build_and_sync() {
  local ids
  ids=$(python3 -c "import sys; sys.path.insert(0, 'tools/blender/epilogue'); import shots; print(' '.join(s['id'] for s in shots.SHOTS))")
  rm -rf art/blender/epilogue
  for id in $ids; do
    blender -b --factory-startup --python-exit-code 1 -P tools/blender/build_epilogue.py -- "$id" | grep -E '^built|Error|Traceback'
  done
  rsync -a --delete --exclude __pycache__ tools/blender "$HOST:$REMOTE/"
  rsync -a --delete art/blender/epilogue "$HOST:$REMOTE/art/blender/"
}

case "${1:-}" in
  --status)
    job="$(cat "$LAST" 2>/dev/null)" || { echo "no job started from here yet"; exit 1; }
    ssh "$HOST" "$SRJOB status $job; $SRJOB log $job | tail -n 5"
    ;;
  --fetch)
    mkdir -p remastered/epilogue
    rsync -a "$HOST:$REMOTE/out/epilogue/epilogue.mp4" "$HOST:$REMOTE/out/epilogue/poster.jpg" remastered/epilogue/
    ls -l remastered/epilogue
    ;;
  --preview)
    build_and_sync
    job="epilogue-preview-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "rm -rf \$HOME/$REMOTE/out/epilogue-preview; $SRJOB start $job 'PREVIEW=${3:-72} PREVIEW_SHOT=${2:-} bash \$HOME/$REMOTE/blender/epilogue_job.sh'" >/dev/null
    echo "preview job $job on $HOST"
    ssh "$HOST" "$SRJOB wait $job" >/dev/null || { ssh "$HOST" "$SRJOB log $job | tail -n 20"; exit 1; }
    ssh "$HOST" "$SRJOB log $job" | grep '\[morrow\]'
    rm -rf build/epilogue-preview && mkdir -p build/epilogue-preview
    rsync -a "$HOST:$REMOTE/out/epilogue-preview/" build/epilogue-preview/
    echo "previews in build/epilogue-preview/"
    ;;
  ""|--resume|--redo)
    build_and_sync
    case "${1:-}" in
      --resume) ;;
      --redo) [ -n "${2:-}" ] || { echo "--redo needs a shot id, e.g. 03-hall"; exit 1; }
              gone=""; for s in "${@:2}"; do gone="$gone '$s' '$s.mp4'"; done
              ssh "$HOST" "cd \$HOME/$REMOTE/out/epilogue && rm -rf $gone epilogue.mp4 poster.jpg" ;;
      *) ssh "$HOST" "rm -rf \$HOME/$REMOTE/out/epilogue" ;;
    esac
    job="epilogue-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "$SRJOB start $job 'bash \$HOME/$REMOTE/blender/epilogue_job.sh'" >/dev/null
    mkdir -p build && echo "$job" > "$LAST"
    echo "film job $job started on $HOST; check with --status, then --fetch when it is done"
    ;;
  *)
    sed -n '2,14p' "$0"; exit 1 ;;
esac
