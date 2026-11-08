#!/usr/bin/env python3
"""Voice the trailer's voiceover and lay it on the film's timeline.

    python3 tools/trailer/voiceover.py out/trailer

Reads tools/trailer/voiceover.json. The speaker is cast as the game casts
her (tools/voice/voices.json `writers`): that voice model, through that
filter. Each sentence is voiced in several takes and Whisper picks the
clearest, exactly as the game's own lines are made (tools/voice/
build_voices.py). Writes <out>/audio/voiceover.wav: 48 kHz stereo, the
film's length, silence except where she speaks.
"""
from __future__ import annotations

import array
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "voice"))
import build_voices as bv  # noqa: E402

sys.path.insert(0, str(HERE))
import cut  # noqa: E402

GAP = 0.25            # at least this much air between two lines
ROOM = "aecho=0.8:0.55:45:0.12"   # a little of the room she is speaking in
BURST = 2.4           # a 10 ms frame this many times louder than the take's speech is a burst, not a word


def burst(path: Path) -> float:
    """How far the loudest 10 ms of a take stands above its speech (the 90th
    percentile of its voiced frames). Ordinary speech is under 2; a glitch
    of noise stands at 3 to 6."""
    with bv.wave.open(str(path)) as w:
        rate, ch = w.getframerate(), w.getnchannels()
        a = array.array("h", w.readframes(w.getnframes()))[::ch]
    n = max(1, rate // 100)
    rms = [(sum(x * x for x in a[i:i + n]) / n) ** 0.5 for i in range(0, len(a) - n, n)]
    voiced = sorted(x for x in rms if x > 0.05 * max(rms))
    return max(rms) / voiced[int(len(voiced) * 0.9)] if voiced else 0.0


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "out/trailer").resolve()
    script = json.loads((HERE / "voiceover.json").read_text())
    casting = json.loads(bv.CASTING.read_text())
    writer = casting["writers"][script["voice"]]
    voice = bv.voice_config(casting, writer["voice"])
    _starts, total = cut.timeline()

    work = Path(tempfile.mkdtemp(prefix="morrow-vo-"))
    try:
        plan = []
        for n, line in enumerate(script["lines"]):
            takes = []
            for s, sentence in enumerate(bv.sentences(line["text"])):
                paths = []
                for t, take in enumerate(voice["takes"]):
                    p = work / f"{n}.{s}.{t}.wav"
                    bv.synthesize(voice, sentence, take, p)
                    paths.append(p)
                takes.append((sentence, paths))
            plan.append((line, takes))
        every = [str(p) for _, takes in plan for _, paths in takes for p in paths]
        heard = json.loads(subprocess.run(
            [bv.WHISPER_PY, str(HERE.parent / "voice" / "score_takes.py")],
            input=json.dumps({"takes": every, "model": os.environ.get("MORROW_WHISPER_MODEL", "small")}),
            check=True, capture_output=True, text=True).stdout)

        placed, cursor = [], 0.0
        for n, (line, takes) in enumerate(plan):
            parts = []
            for k, (sentence, paths) in enumerate(takes):
                # Every take through her filter, then the clearest take without a burst.
                shaped = [bv.conform(p, work / f"{n}.{k}.{t}.shaped.wav", writer.get("filter")) for t, p in enumerate(paths)]
                score = {str(q): (bv.wer(sentence, heard[str(p)]) > 0.15, burst(q) > BURST, bv.wer(sentence, heard[str(p)]))
                         for p, q in zip(paths, shaped)}
                best = min(shaped, key=lambda q: score[str(q)])
                if score[str(best)][1]:
                    print(f"[morrow] voiceover line {n + 1}: every take of {sentence!r} has a burst ({burst(best):.1f})")
                parts.append(best)
            joined = work / f"{n}.wav"
            seconds = bv.join(parts, joined)
            at = max(float(line["at"]), cursor)
            if at - float(line["at"]) > 0.05:
                print(f"[morrow] voiceover line {n + 1} pushed from {line['at']}s to {at:.2f}s (the line before runs long)")
            cursor = at + seconds + GAP
            placed.append((joined, at))
            print(f"[morrow] voiceover {at:5.2f}s-{at + seconds:5.2f}s  {line['text']}", flush=True)
        if cursor - GAP > total:
            raise SystemExit(f"the voiceover runs to {cursor - GAP:.1f}s, past the film's {total:.1f}s")

        inputs, graph = [], []
        for i, (wav, at) in enumerate(placed):
            inputs += ["-i", str(wav)]
            ms = int(at * 1000)
            graph.append(f"[{i}:a]aresample=48000,{ROOM},adelay={ms}|{ms}[v{i}]")
        graph.append("".join(f"[v{i}]" for i in range(len(placed))) +
                     f"amix=inputs={len(placed)}:normalize=0,apad,atrim=0:{total:.3f},"
                     "loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,aformat=channel_layouts=stereo[vo]")
        dest = out / "audio" / "voiceover.wav"
        dest.parent.mkdir(parents=True, exist_ok=True)
        cut.run(inputs + ["-filter_complex", ";".join(graph), "-map", "[vo]", "-ar", "48000", "-ac", "2", str(dest)])
        print(f"[morrow] voiceover: loudest moment {burst(dest):.2f}x its speech (a burst would be 3 or more)", flush=True)
        print(f"[morrow] voiceover: {dest}", flush=True)
    finally:
        for p in work.iterdir():
            p.unlink()
        work.rmdir()


if __name__ == "__main__":
    main()
