#!/usr/bin/env python3
"""Cut the trailer: shots, cards and music to one YouTube-ready film.

    python3 tools/trailer/cut.py out/trailer                  the film, music from the game's cues
    python3 tools/trailer/cut.py out/trailer --score          the film, music from the trailer's own score
    python3 tools/trailer/cut.py out/trailer --voiceover      the film, that score with the voiceover, written
                                                              as sunken-crown-trailer-voiceover.mp4
    python3 tools/trailer/cut.py out/trailer --score-preview  only the score, to listen to, and the
                                                              finished film with it laid under (no re-cut)
    python3 tools/trailer/cut.py out/trailer --voiceover-preview  the same, with the grandmother's
                                                              voiceover (voiceover.py) over the score

Reads out/trailer/shots/<shot>/####.png (Blender), cards/*.png, ega/*.png and
audio/*.wav (capture.mjs), and writes sunken-crown-trailer.mp4 (1920x1080,
24 fps, H.264 High, AAC 48 kHz stereo, loudness -14 LUFS, +faststart) and
thumbnail.jpg (1280x720). The edit is the table in
docs/remastered/trailer-plan.md; every time below is in seconds.
"""
from __future__ import annotations

import os
import subprocess
import sys

FPS = 24
W, H = 1920, 1080
FADE = 0.5            # the usual dissolve between shots
# --master: an upload master for YouTube, near-lossless (about 15-20 Mbps), as
# "-master.mp4"; the usual cut is a lighter file for sharing.
MASTER = "--master" in sys.argv
SEGMENT_CRF, FINAL_CRF = ("6", "10") if MASTER else ("14", "18")

# (source, seconds, transition into the NEXT segment, card or None, card offset, card length)
EDIT = [
    ("black", 4.0, ("fadeblack", 0.6), "presents", 0.5, 3.0),
    ("t01-yard", 5.0, ("fade", FADE), "drowned", 1.0, 3.4),
    ("t02-yard-hero", 4.0, ("fade", FADE), None, 0, 0),
    ("ega:hall", 3.0, ("pixelize", 1.2), "ega1", 0.3, 2.3),
    ("t03-hall", 5.0, ("fade", FADE), "ega2", 0.6, 3.2),
    ("t04-cellar", 4.0, ("fade", FADE), None, 0, 0),
    ("t05-cave", 4.0, ("fade", FADE), "unclaimed", 0.6, 3.0),
    ("t06-lake", 4.0, ("fade", FADE), None, 0, 0),
    ("t07-umbra", 4.0, ("fade", 0.3), None, 0, 0),
    ("t08-sentinel", 3.0, ("fade", 0.3), None, 0, 0),
    ("t09-mirrors", 3.0, ("fadeblack", FADE), None, 0, 0),
    ("t10-throne", 6.0, ("fade", 0.8), "reborn", 1.0, 3.6),
    ("t11-throne-title", 6.0, ("fade", FADE), "title", 0.4, 5.2),
    ("t12-study", 2.5, ("fade", FADE), "f1", 0.2, 2.0),
    ("t13-glasshouse", 2.5, ("fade", FADE), "f2", 0.2, 2.0),
    ("t14-grandmother", 2.5, ("fade", FADE), "f3", 0.2, 2.0),
    ("t15-garden", 2.5, ("fadeblack", 0.6), "f4", 0.2, 2.0),
    ("black", 7.0, None, "end", 0.4, 6.6),
]
# The music: (cue, starts with segment, offset from that segment's start)
MUSIC = [("title", 0, 0.0), ("tension", 5, -1.0), ("combat", 8, -0.2), ("lullaby", 11, -0.6)]


def run(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + args, check=True)


def clip(out: str, k: int, source: str, seconds: float, card: str | None, off: float, length: float) -> str:
    """One segment of the edit, with its card already burned in. Doing the
    cards here, a segment at a time, keeps the final graph small: laid over
    the whole film at once they made ffmpeg buffer most of it."""
    path = os.path.join(out, "cut", f"{k:02d}.mp4")
    if source == "black":
        src = ["-f", "lavfi", "-i", f"color=c=black:s={W}x{H}:r={FPS}:d={seconds}"]
        base = "[0:v]null"
    elif source.startswith("ega:"):
        # The EGA picture as the game paints it, every pixel kept square and sharp.
        src = ["-loop", "1", "-framerate", str(FPS), "-i", os.path.join(out, "ega", source[4:] + ".png")]
        base = f"[0:v]scale={W}:{W * 200 // 320}:flags=neighbor,crop={W}:{H}"
    else:
        src = ["-framerate", str(FPS), "-i", os.path.join(out, "shots", source, "%04d.png")]
        base = f"[0:v]scale={W}:{H}"
    graph = base + ",fps=24,format=yuv420p[v]"
    if card:
        src += ["-loop", "1", "-framerate", str(FPS), "-i", os.path.join(out, "cards", card + ".png")]
        graph = (base + f",fps=24[b];[1:v]format=rgba,fade=t=in:st={off:.3f}:d=0.5:alpha=1,"
                 f"fade=t=out:st={off + length - 0.6:.3f}:d=0.6:alpha=1[c];[b][c]overlay=0:0:shortest=1,format=yuv420p[v]")
    run(src + ["-filter_complex", graph, "-map", "[v]", "-c:v", "libx264", "-crf", SEGMENT_CRF, "-preset", "fast",
               "-r", str(FPS), "-t", f"{seconds:.3f}", path])
    return path


LOUDNESS = "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000"


def timeline() -> tuple[list[float], float]:
    """Where each segment starts once the dissolves overlap them, and the
    film's length. tools/trailer/score.js's MARKS are these times."""
    starts, t = [], 0.0
    for _src, secs, trans, *_rest in EDIT:
        starts.append(t)
        t += secs - (trans[1] if trans else 0.0)
    return starts, starts[-1] + EDIT[-1][1]


def score_track(out: str, total: float) -> str:
    """The trailer's own score (capture.mjs renders it), at YouTube's loudness."""
    music = os.path.join(out, "cut", "score.wav")
    run(["-i", os.path.join(out, "audio", "trailer-score.wav"), "-af",
         f"atrim=0:{total:.3f},afade=t=out:st={total - 2.0:.3f}:d=2.0," + LOUDNESS,
         "-ar", "48000", "-ac", "2", music])
    return music


def score_preview(out: str) -> None:
    """To listen before it goes in: the score on its own, and the finished
    film with the score laid under in place of the cues (picture copied)."""
    os.makedirs(os.path.join(out, "cut"), exist_ok=True)
    _starts, total = timeline()
    music = score_track(out, total)
    listen = os.path.join(out, "trailer-score.m4a")
    run(["-i", music, "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", listen])
    film = os.path.join(out, "sunken-crown-trailer.mp4")
    scored = os.path.join(out, "sunken-crown-trailer-scored-preview.mp4")
    run(["-i", film, "-i", music, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k",
         "-shortest", "-movflags", "+faststart", scored])
    print(f"[morrow] score preview: {listen} and {scored}", flush=True)


def voiceover_track(out: str, total: float) -> str:
    """The score with the voiceover over it: the music dips under her voice
    (sidechain), then the mix is brought to YouTube's loudness."""
    mixed = os.path.join(out, "cut", "score-voiceover.wav")
    run(["-i", os.path.join(out, "audio", "trailer-score.wav"), "-i", os.path.join(out, "audio", "voiceover.wav"),
         "-filter_complex",
         "[1:a]asplit=2[vo][key];"
         "[0:a][key]sidechaincompress=threshold=0.03:ratio=3:attack=60:release=900:makeup=1[bed];"
         f"[bed][vo]amix=inputs=2:normalize=0:weights=1 1.25,atrim=0:{total:.3f},"
         f"afade=t=out:st={total - 2.0:.3f}:d=2.0," + LOUDNESS,
         "-ar", "48000", "-ac", "2", mixed])
    return mixed


def voiceover_preview(out: str) -> None:
    os.makedirs(os.path.join(out, "cut"), exist_ok=True)
    _starts, total = timeline()
    music = voiceover_track(out, total)
    listen = os.path.join(out, "trailer-score-voiceover.m4a")
    run(["-i", music, "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", listen])
    scored = os.path.join(out, "sunken-crown-trailer-voiceover-preview.mp4")
    run(["-i", os.path.join(out, "sunken-crown-trailer.mp4"), "-i", music, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", scored])
    print(f"[morrow] voiceover preview: {listen} and {scored}", flush=True)


def main() -> None:
    out = os.path.abspath(next((a for a in sys.argv[1:] if not a.startswith("--")), "out/trailer"))
    if "--score-preview" in sys.argv:
        score_preview(out)
        return
    if "--voiceover-preview" in sys.argv:
        voiceover_preview(out)
        return
    os.makedirs(os.path.join(out, "cut"), exist_ok=True)
    clips = [clip(out, k, src, secs, card, off, length) for k, (src, secs, _t, card, off, length) in enumerate(EDIT)]
    starts, total = timeline()

    inputs, graph = [], []
    for c in clips:
        inputs += ["-i", c]
    prev = "[0:v]"
    for k in range(1, len(EDIT)):
        kind, dur = EDIT[k - 1][2]
        graph.append(f"{prev}[{k}:v]xfade=transition={kind}:duration={dur}:offset={starts[k]:.3f}[v{k}]")
        prev = f"[v{k}]"
    graph.append(f"{prev}format=yuv420p[film]")

    # The music, on its own pass: the trailer's score, or each of the
    # game's cues faded in and out, placed, mixed, and brought to YouTube's loudness.
    if "--voiceover" in sys.argv:
        music = voiceover_track(out, total)
    else:
        music = score_track(out, total) if "--score" in sys.argv else cue_mix(out, starts, total)
    inputs += ["-i", music]

    film = os.path.join(out, "sunken-crown-trailer-voiceover.mp4" if "--voiceover" in sys.argv else "sunken-crown-trailer.mp4")
    if MASTER:
        film = film.replace(".mp4", "-master.mp4")
    run(inputs + ["-filter_complex", ";".join(graph), "-map", "[film]", "-map", f"{len(clips)}:a",
                  "-c:v", "libx264", "-crf", FINAL_CRF, "-preset", "slow", "-profile:v", "high", "-tune", "film", "-r", str(FPS),
                  "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", "-t", f"{total:.3f}", "-movflags", "+faststart", film])

    # The thumbnail: the box-art still with the title over it.
    thumb_frame = os.path.join(out, "shots", "thumb", "0001.png")
    run(["-i", thumb_frame, "-i", os.path.join(out, "cards", "thumb.png"), "-filter_complex",
         "[0:v]scale=1280:720[b];[b][1:v]overlay=0:0", "-q:v", "2", os.path.join(out, "thumbnail.jpg")])
    size = os.path.getsize(film) / 1e6
    print(f"[morrow] trailer: {film} ({total:.1f}s, {size:.1f} MB) and thumbnail.jpg", flush=True)


def cue_mix(out: str, starts: list[float], total: float) -> str:
    ains, mix = [], []
    for i, (cue, seg, off) in enumerate(MUSIC):
        ains += ["-i", os.path.join(out, "audio", cue + ".wav")]
        at = max(0.0, starts[seg] + off)
        mix.append(f"[{i}:a]afade=t=in:st=0:d=1.2,afade=t=out:st={_cue_len(out, cue) - 2.0:.3f}:d=2.0,"
                   f"adelay={int(at * 1000)}|{int(at * 1000)}[a{i}]")
    mix.append("".join(f"[a{i}]" for i in range(len(MUSIC))) + f"amix=inputs={len(MUSIC)}:normalize=0,"
               f"atrim=0:{total:.3f},afade=t=out:st={total - 3.0:.3f}:d=3.0," + LOUDNESS + "[mix]")
    music = os.path.join(out, "cut", "music.wav")
    run(ains + ["-filter_complex", ";".join(mix), "-map", "[mix]", "-ar", "48000", "-ac", "2", music])
    return music


def _cue_len(out: str, cue: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                        os.path.join(out, "audio", cue + ".wav")], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


if __name__ == "__main__":
    main()
