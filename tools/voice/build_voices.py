"""Voice a Morrowlamp cartridge's script with Piper, one sentence at a time.

    python3 tools/voice/build_voices.py js/cartridges/sunken-crown.js \
        [--narrator cori] [--room hall] [--keys dfe1fae1,29263ec7] [--takes 3] [--force]

The player chooses a narrator, so the script is recorded once per narrator
in voices.json. It is read from `node tools/morrow.js strings --json`.
Each sentence is synthesized on its own (multi-sentence Piper calls
degrade into noise after the first sentence), in several takes with
different noise settings; Whisper transcribes every take and the one that
reads back closest to the text wins. Sentences are joined,
loudness-normalized and encoded to Opus (WebM).

Writes, under remastered/voice/:
  index.json            the narrators on offer and every narrative line key
                        (a device voice needs the keys, not the recordings)
  <narrator>/lines.json that narrator's clips, fetched only if chosen
  <narrator>/<room>/<key>.webm

Written words are not the narrator's. When a line comes from a readable
object that voices.json gives a writer (the grandmother's note, the
chroniclers' books), its quoted words are read in the writer's voice,
through the writer's filter, and the framing around them stays with the
narrator; the parts are joined into one clip, so the game needs no
special case. A writer never shares the player's narrator's voice.

Incremental: a key is the hash of the line's text, so an unchanged line is
never re-voiced and an edited line gets a new key automatically. Clips
whose line has left the script are deleted.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VOICE_DIR = ROOT / "remastered" / "voice"
INDEX = VOICE_DIR / "index.json"
CASTING = Path(__file__).with_name("voices.json")
WHISPER_PY = os.environ.get(
    "MORROW_WHISPER_PY", str(Path.home() / ".local/share/pipx/venvs/whisper-ctranslate2/bin/python"))
GAP_SECONDS = 0.3
SENTENCE = re.compile(r"(?<=[.!?…])[\"”’)]?\s+(?=[\"“(A-Z])")
QUOTED = re.compile(r'([“"][^”"]+[”"])')
CITED = re.compile(r'^(.*:)\s*([“"][^”"]+[”"])\s*$')
WRITTEN_FROM = re.compile(r"^world\.objects\.(\w+)\.(read|examine|text)\b")
RATE = 22050
BATCH = 24             # lines voiced, then saved


def script(cartridge: str) -> list[dict]:
    out = subprocess.run(["node", str(ROOT / "tools/morrow.js"), "strings", cartridge, "--json"],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)["lines"]


def sentences(text: str) -> list[str]:
    return [s.strip() for s in SENTENCE.split(text) if s.strip()]


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower().replace("—", " "))


def wer(ref: str, hyp: str) -> float:
    r, h = words(ref), words(hyp)
    if not r:
        return 0.0
    prev = list(range(len(h) + 1))
    for i, rw in enumerate(r, 1):
        cur = [i] + [0] * len(h)
        for j, hw in enumerate(h, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (rw != hw))
        prev = cur
    return prev[-1] / len(r)


def synthesize(voice: dict, text: str, take: dict, path: Path) -> None:
    model = os.path.expanduser(voice["model"])
    cmd = ["piper", "--model", model, "--output_file", str(path),
           "--length-scale", str(take.get("length_scale", voice.get("length_scale", 1.0))),
           "--noise-scale", str(take["noise_scale"]), "--noise-w-scale", str(take["noise_w"])]
    if voice.get("speaker") is not None:
        cmd += ["--speaker", str(voice["speaker"])]
    subprocess.run(cmd, input=text, text=True, check=True, capture_output=True)


VIBRATO = re.compile(r"(?:^|,)vibrato=f=([\d.]+):d=([\d.]+)")


def conform(src: Path, dest: Path, audio_filter: str | None) -> Path:
    """One sample format for every part of a clip, plus the writer's filter.

    A `vibrato=f=..:d=..` in the filter is done here, not by ffmpeg: its
    vibrato filter throws out a glitch that a high-pass after it turns into
    a blast of noise at full scale (the trailer's "clipping", 2026-11-07)."""
    wobble = VIBRATO.search(audio_filter or "")
    if wobble:
        audio_filter = VIBRATO.sub("", audio_filter).strip(",") or None
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(src)]
    if audio_filter:
        cmd += ["-af", audio_filter]
    subprocess.run(cmd + ["-ar", str(RATE), "-ac", "1", "-sample_fmt", "s16", str(dest)], check=True)
    if wobble:
        vibrato(dest, float(wobble.group(1)), float(wobble.group(2)))
    return dest


def vibrato(path: Path, freq: float, depth: float) -> None:
    """The waver of an old voice: read each sample through a delay that swings
    by up to `depth` x 5 ms, `freq` times a second, with linear interpolation."""
    import array
    with wave.open(str(path)) as w:
        params = w.getparams()
        x = array.array("h", w.readframes(w.getnframes()))
    rate = params.framerate
    swing = depth * 0.005 * rate
    out = array.array("h", bytes(2 * len(x)))
    for n in range(len(x)):
        t = n - swing * (1 + math.sin(2 * math.pi * freq * n / rate))
        i = int(math.floor(t))
        if i < 0 or i + 1 >= len(x):
            continue
        frac = t - i
        out[n] = int(round(x[i] * (1 - frac) + x[i + 1] * frac))
    with wave.open(str(path), "wb") as w:
        w.setparams(params)
        w.writeframes(out.tobytes())


def writer_of(line: dict, casting: dict) -> tuple[str, dict] | None:
    for where in line.get("from", []):
        m = WRITTEN_FROM.match(where)
        if not m:
            continue
        for wid, w in casting.get("writers", {}).items():
            if isinstance(w, dict) and m.group(1) in w.get("objects", []):
                return wid, w
    return None


def segments(text: str, narrator: str, writer: tuple[str, dict] | None) -> list[tuple[str, str | None, str]]:
    """(voice id, filter, text) runs. The writer reads a message that is all
    quotation, or the quotation that ends a message after a colon ("Scrawled
    at the bottom: "P.S. ...""). A quoted title or a phrase quoted mid-
    sentence is the narrator's, so no sentence is split between voices."""
    if not writer:
        return [(narrator, None, text)]
    w = writer[1]
    voice = w.get("instead", {}).get(narrator, w["voice"])
    if QUOTED.fullmatch(text.strip()):
        return [(voice, w.get("filter"), text.strip())]
    m = CITED.match(text)
    if m:
        return [(narrator, None, m.group(1).strip()), (voice, w.get("filter"), m.group(2).strip())]
    return [(narrator, None, text)]


def speaker_of(parts: list[tuple[str, str | None, str]], narrator: str, writer: tuple[str, dict] | None) -> str:
    if not writer or all(v == narrator and f is None for v, f, _ in parts):
        return "narrator"
    return writer[0] if all(f is not None or v != narrator for v, f, _ in parts) else "narrator+" + writer[0]


def join(parts: list[Path], out_wav: Path) -> float:
    """Concatenate WAVs with a breath of silence between sentences."""
    frames, params = [], None
    for p in parts:
        with wave.open(str(p)) as w:
            params = params or w.getparams()
            frames.append(w.readframes(w.getnframes()))
    assert params is not None
    gap = b"\x00" * int(params.framerate * GAP_SECONDS) * params.sampwidth * params.nchannels
    with wave.open(str(out_wav), "wb") as w:
        w.setparams(params)
        w.writeframes(gap.join(frames))
        total = w.getnframes()
    return total / params.framerate


def encode(wav: Path, dest: Path, kbps: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav),
                    "-af", "highpass=f=70,loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000",
                    "-c:a", "libopus", "-b:a", f"{kbps}k", "-application", "voip", str(dest)], check=True)


def read_json(path: Path, empty: dict) -> dict:
    return json.loads(path.read_text()) if path.exists() else empty


def voice_config(casting: dict, vid: str) -> dict:
    return casting["narrators"].get(vid) or casting["cast"][vid]


def voice_lines(narrator: str, casting: dict, lines: list[dict], args: argparse.Namespace, kbps: int,
                have: dict) -> None:
    """Record `lines` for one narrator into `have` (key -> clip entry)."""
    work = Path(tempfile.mkdtemp(prefix=f"morrow-voice-{narrator}-"))
    try:
        # Per line: its speaker, then (sentence, takes, filter) for every sentence of every part.
        plan: list[tuple[dict, str, list[tuple[str, list[Path], str | None]]]] = []
        for ln in lines:
            writer = writer_of(ln, casting)
            parts = segments(ln["text"], narrator, writer)
            todo = []
            for pi, (vid, audio_filter, text) in enumerate(parts):
                voice = voice_config(casting, vid)
                takes = voice["takes"][: args.takes]
                for si, sentence in enumerate(sentences(text)):
                    paths = []
                    for ti, take in enumerate(takes):
                        p = work / f"{ln['key']}.{pi}.{si}.{ti}.wav"
                        synthesize(voice, sentence, take, p)
                        paths.append(p)
                    todo.append((sentence, paths, audio_filter))
            plan.append((ln, speaker_of(parts, narrator, writer), todo))
            voices = "+".join(dict.fromkeys(v for v, _, _ in parts))
            print(f"synth {narrator} {ln['key']} {ln['room']}: {len(todo)} sentences, voices {voices}")

        every = [str(p) for _, _, todo in plan for _, tk, _ in todo for p in tk]
        heard = json.loads(subprocess.run([WHISPER_PY, str(Path(__file__).with_name("score_takes.py"))],
                                          input=json.dumps({"takes": every, "model": args.whisper_model,
                                                            "threads": int(os.environ.get("MORROW_WHISPER_THREADS", "0"))}),
                                          check=True, capture_output=True, text=True).stdout)

        for ln, speaker, todo in plan:
            chosen, scores = [], []
            for n, (sentence, tk, audio_filter) in enumerate(todo):
                best = min(tk, key=lambda p: (wer(sentence, heard[str(p)]), tk.index(p)))
                chosen.append(conform(best, work / f"{ln['key']}.part{n}.wav", audio_filter))
                scores.append(round(wer(sentence, heard[str(best)]), 3))
            joined = work / f"{ln['key']}.wav"
            seconds = join(chosen, joined)
            rel = Path(ln["room"]) / f"{ln['key']}.webm"
            encode(joined, VOICE_DIR / narrator / rel, kbps)
            have[ln["key"]] = {"file": rel.as_posix(), "room": ln["room"], "speaker": speaker,
                               "seconds": round(seconds, 2), "wer": max(scores)}
            flag = "  CHECK" if max(scores) > 0.15 else ""
            print(f"voiced {narrator} {ln['key']} {seconds:5.1f}s worst-sentence WER {max(scores):.2f}{flag}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


def prune(narrator: str, have: dict, keys: set[str]) -> None:
    for key in [k for k in have if k not in keys]:
        (VOICE_DIR / narrator / have[key]["file"]).unlink(missing_ok=True)
        del have[key]
        print(f"pruned {narrator} {key}: no longer in the script")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cartridge")
    ap.add_argument("--narrator", action="append", help="record only this narrator (default: all)")
    ap.add_argument("--room", action="append", help="voice only lines belonging to this room")
    ap.add_argument("--keys", default="", help="comma-separated line keys")
    ap.add_argument("--takes", type=int, default=3)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--whisper-model", default="base.en")
    args = ap.parse_args()

    casting = json.loads(CASTING.read_text())
    kbps = int(casting.get("bitrate_kbps", 12))
    full = script(args.cartridge)
    keys = {ln["key"] for ln in full}
    wanted = {k for k in args.keys.split(",") if k}
    chosen = args.narrator or list(casting["narrators"])
    index = read_json(INDEX, {})

    for narrator in chosen:
        lines_path = VOICE_DIR / narrator / "lines.json"
        have = read_json(lines_path, {})
        prune(narrator, have, keys)
        todo = [ln for ln in full
                if (not args.room or ln["room"] in args.room) and (not wanted or ln["key"] in wanted)
                and (args.force or ln["key"] not in have)]
        lines_path.parent.mkdir(parents=True, exist_ok=True)
        if not todo:
            print(f"{narrator}: nothing to voice")
        # A batch at a time, saved after each, so a long run that stops resumes where it was.
        for at in range(0, len(todo), BATCH):
            voice_lines(narrator, casting, todo[at:at + BATCH], args, kbps, have)
            lines_path.write_text(json.dumps(dict(sorted(have.items())), indent=1) + "\n")
            print(f"{narrator}: {min(at + BATCH, len(todo))} of {len(todo)} lines voiced", flush=True)
        lines_path.write_text(json.dumps(dict(sorted(have.items())), indent=1) + "\n")

    narrators = {}
    for narrator, voice in casting["narrators"].items():
        have = read_json(VOICE_DIR / narrator / "lines.json", {})
        if not have:
            continue
        size = sum((VOICE_DIR / narrator / c["file"]).stat().st_size for c in have.values())
        narrators[narrator] = {"label": voice["label"], "blurb": voice["blurb"], "lines": f"{narrator}/lines.json",
                               "clips": len(have), "seconds": round(sum(c["seconds"] for c in have.values()), 1),
                               "bytes": size}
    written = {}
    for ln in full:
        w = writer_of(ln, casting)
        if w and speaker_of(segments(ln["text"], "", w), "", w) != "narrator":
            written[ln["key"]] = w[0]
    index = {"default": casting["default"], "narrators": narrators,
             "script": {ln["key"]: ln["room"] for ln in sorted(full, key=lambda x: x["key"])},
             "written": dict(sorted(written.items()))}
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(index, indent=1) + "\n")


if __name__ == "__main__":
    main()
