#!/usr/bin/env bash
# Send the voice script to the worker, check on it, and bring the clips home.
#
#   tools/voice/send_voices.sh            sync and start the job (keeps clips already recorded)
#   tools/voice/send_voices.sh --status   how the last job is doing
#   tools/voice/send_voices.sh --fetch    copy remastered/voice back from the worker
#
# The worker has the cores (Piper and Whisper are CPU work). Its voice
# models are kept at the paths voices.json names; this copies any missing.
set -euo pipefail

HOST="${MORROW_HOST:-showrig-worker}"
REMOTE="${MORROW_VOICE_REMOTE:-morrowlamp-voice}"
SRJOB="${MORROW_SRJOB:-\$HOME/showrig-worker/bin/srjob}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LAST="$ROOT/build/voice-job"
cd "$ROOT"

case "${1:-}" in
  --status)
    job="$(cat "$LAST" 2>/dev/null)" || { echo "no job started from here yet"; exit 1; }
    ssh "$HOST" "$SRJOB status $job; $SRJOB log $job | tail -n 8; cd $REMOTE && tail -qn 1 out/voice-logs/*.log 2>/dev/null"
    ;;
  --fetch)
    rsync -a --delete "$HOST:$REMOTE/remastered/voice/" remastered/voice/
    python3 -c "import json; d=json.load(open('remastered/voice/index.json')); print({k: v['clips'] for k, v in d['narrators'].items()}, len(d['script']), 'lines')"
    ;;
  "")
    for m in $(python3 -c "import json; c=json.load(open('tools/voice/voices.json')); print(' '.join(sorted({v['model'] for g in ('narrators', 'cast') for v in c.get(g, {}).values()})))"); do
      local_path="${m/#\~/$HOME}"
      ssh "$HOST" "test -e $m" || { ssh "$HOST" "mkdir -p \$(dirname $m)"; rsync -a "$local_path" "$local_path.json" "$HOST:$(dirname "$m")/"; }
    done
    ssh "$HOST" "mkdir -p $REMOTE/tools $REMOTE/remastered"
    rsync -a --delete --exclude __pycache__ tools/voice "$HOST:$REMOTE/tools/"
    rsync -a tools/morrow.js "$HOST:$REMOTE/tools/"
    rsync -a --delete js "$HOST:$REMOTE/"
    rsync -a --delete remastered/voice "$HOST:$REMOTE/remastered/"
    job="voice-$(date +%Y%m%d-%H%M%S)"
    ssh "$HOST" "$SRJOB start $job 'bash \$HOME/$REMOTE/tools/voice/voice_job.sh'" >/dev/null
    mkdir -p build && echo "$job" > "$LAST"
    echo "voice job $job started on $HOST; check with --status, then --fetch when it is done"
    ;;
  *)
    sed -n '2,9p' "$0"; exit 1 ;;
esac
