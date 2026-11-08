#!/usr/bin/env bash
# Voice the whole script on the worker, every narrator at once. Runs
# unattended inside an srjob job started by send_voices.sh.
#
#   bash tools/voice/voice_job.sh        every line not yet recorded, all narrators
#
# Run from the synced folder (~/morrowlamp-voice). Each narrator saves its
# lines a batch at a time, so running it again resumes. The last step
# rebuilds remastered/voice/index.json once every narrator has finished.
set -euo pipefail

cd "${MORROW_VOICE_DIR:-$HOME/morrowlamp-voice}"
export PATH="$HOME/.local/bin:$PATH"
CART=js/cartridges/sunken-crown.js
MODEL="${MORROW_WHISPER_MODEL:-small}"
NARRATORS=$(python3 -c "import json; print(' '.join(json.load(open('tools/voice/voices.json'))['narrators']))")
export PYTHONUNBUFFERED=1
export MORROW_WHISPER_THREADS="${MORROW_WHISPER_THREADS:-8}"

mkdir -p out/voice-logs
pids=()
for n in $NARRATORS; do
  echo "[morrow] voicing $n"
  python3 tools/voice/build_voices.py "$CART" --narrator "$n" --whisper-model "$MODEL" > "out/voice-logs/$n.log" 2>&1 &
  pids+=($!)
done
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=1; done
for n in $NARRATORS; do echo "[morrow] $n: $(grep -c '^voiced' "out/voice-logs/$n.log") voiced, $(grep -c 'CHECK' "out/voice-logs/$n.log") to check"; done
[ "$fail" -eq 0 ] || { echo "[morrow] a narrator failed; see out/voice-logs/"; tail -n 20 out/voice-logs/*.log; exit 1; }
python3 tools/voice/build_voices.py "$CART" --keys none > out/voice-logs/index.log 2>&1
echo "[morrow] voice done"
