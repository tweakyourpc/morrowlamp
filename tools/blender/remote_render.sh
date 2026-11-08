#!/usr/bin/env bash
# Render a remastered room on the GPU box and bring the passes home.
#
#   tools/blender/remote_render.sh hall [render_room.py args...]
#
# Builds the .blend locally, syncs tools and art to $MORROW_HOST, renders
# there, and copies the raw passes back into remastered/rooms/<room>/.
# MORROW_BLENDER is the Blender on that host: the official 5.3 build, with
# OptiX and OpenImageDenoise. Set MORROW_PYPATH only for a Blender that
# ships without numpy (the distro 4.0 build).
set -euo pipefail

ROOM="$1"; shift
HOST="${MORROW_HOST:-showrig-worker}"
REMOTE="${MORROW_REMOTE_DIR:-morrowlamp-render}"
BLENDER="${MORROW_BLENDER:-\$HOME/opt/blender-5.3/blender}"
PYENV=""
[ -n "${MORROW_PYPATH:-}" ] && PYENV="PYTHONPATH=$MORROW_PYPATH"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${MORROW_OUT:-$ROOT/remastered/rooms/$ROOM}"

cd "$ROOT"
blender -b --factory-startup --python-exit-code 1 -P tools/blender/build_room.py -- "$ROOM" | grep -E '^built|Error'
rsync -a --delete --exclude __pycache__ tools/blender art "$HOST:$REMOTE/"
# The render runs as a job on the worker's runner (srjob): it survives a
# dropped connection, holds the worker's sleep lock, and keeps a log.
JOB="morrow-$ROOM-$(date +%Y%m%d-%H%M%S)"
SRJOB="${MORROW_SRJOB:-\$HOME/showrig-worker/bin/srjob}"
ssh "$HOST" "$SRJOB start $JOB 'set -o pipefail; cd \$HOME/$REMOTE && rm -rf out/$ROOM && $PYENV $BLENDER -b ${PYENV:+--python-use-system-env} \
  art/blender/rooms/$ROOM.blend --python-exit-code 1 -P blender/render_room.py -- --out out/$ROOM $*'" >/dev/null
echo "render job $JOB on $HOST"
rc=0
ssh "$HOST" "$SRJOB wait $JOB" >/dev/null || rc=$?
ssh "$HOST" "$SRJOB log $JOB" | grep -E '\[morrow\]|Error|Traceback|File "|line [0-9]' || true
[ "$rc" -eq 0 ] || { echo "render job $JOB failed (exit $rc)"; exit "$rc"; }
mkdir -p "$OUT"
rsync -a --delete "$HOST:$REMOTE/out/$ROOM/" "$OUT/"
echo "passes in $OUT"
