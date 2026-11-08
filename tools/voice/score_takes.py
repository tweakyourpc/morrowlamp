"""Transcribe candidate takes with faster-whisper and print JSON.

Runs under whichever Python has faster_whisper installed (build_voices.py
finds it); reads {"takes": [paths]} on stdin, writes {path: text}.
"""
from __future__ import annotations

import json
import sys


def main() -> None:
    from faster_whisper import WhisperModel

    request = json.load(sys.stdin)
    model = WhisperModel(request.get("model", "base.en"), device="cpu", compute_type="int8",
                         cpu_threads=int(request.get("threads", 0)))
    out: dict[str, str] = {}
    for path in request["takes"]:
        segments, _ = model.transcribe(path, language="en", beam_size=3, vad_filter=False)
        out[path] = " ".join(s.text.strip() for s in segments)
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
