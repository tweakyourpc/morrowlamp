#!/usr/bin/env python3
"""Build, render, and pack every remastered room.

Examples::

    python3 tools/blender/batch_render.py --dry-run
    python3 tools/blender/batch_render.py
    python3 tools/blender/batch_render.py --room yard --room wellBottom
    python3 tools/blender/batch_render.py --room hall --force

Every room renders on legion's GPU: it is built here (a second or two of
scene assembly, no rendering), rendered on the --remote host (default
showrig-worker, Blender 5.3 at ~/opt/blender-5.3 there, or
MORROW_REMOTE_BLENDER) by remote_render.sh, and packed here. If the host is
asleep or unreachable the run stops; it never falls back to this machine's
CPU. --local renders here instead, with MORROW_BLENDER, BLENDER or PATH's
Blender, and only when you ask for it.

The default run is resumable: a room with a room.json and all expected WebP
passes is skipped. Use --force to rebuild it. Logs and a summary go to
build/batch-render/. No internet or AI service is used.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[2]
ROOMS = ROOT / "tools" / "blender" / "rooms"
BLENDS = ROOT / "art" / "blender" / "rooms"
OUTPUTS = ROOT / "remastered" / "rooms"
LOGS = ROOT / "build" / "batch-render"        # ignored by git, and never served with the game
SUMMARY = LOGS / "summary.json"


def room_names() -> list[str]:
    return sorted(p.stem for p in ROOMS.glob("*.py") if p.name != "__init__.py")


def blender_path() -> str:
    selected = os.environ.get("MORROW_BLENDER") or os.environ.get("BLENDER")
    if selected:
        return selected
    found = shutil.which("blender")
    if found:
        return found
    raise RuntimeError("Blender was not found; set MORROW_BLENDER or add blender to PATH")


def run(command: list[str], log: Path, dry_run: bool, env: dict[str, str] | None = None) -> None:
    print("$ " + " ".join(command))
    if dry_run:
        return
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as stream:
        stream.write("$ " + " ".join(command) + "\n")
        stream.flush()
        result = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, env=env)
    if result.returncode:
        raise RuntimeError(f"command failed with exit {result.returncode}; see {log}")


def complete(folder: Path) -> bool:
    required = {"room.json", "beauty.webp", "albedo.webp", "normal.webp", "emit.webp", "data.webp"}
    return required.issubset({p.name for p in folder.iterdir()}) if folder.is_dir() else False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--room", action="append", dest="rooms", help="room name; repeatable (default: all)")
    parser.add_argument("--remote", metavar="HOST", default="showrig-worker", help="ssh host whose GPU renders (default: showrig-worker)")
    parser.add_argument("--local", action="store_true", help="render on this machine instead (CPU here: hours a room)")
    parser.add_argument("--samples", type=int, default=512)
    parser.add_argument("--scale", type=int, default=100)
    parser.add_argument("--quality", type=int, default=84)
    parser.add_argument("--light-quality", type=int, default=72)
    parser.add_argument("--force", action="store_true", help="rerun rooms that already have complete output")
    parser.add_argument("--dry-run", action="store_true", help="print commands without checking Blender or running them")
    args = parser.parse_args()

    available = room_names()
    selected = args.rooms or available
    unknown = sorted(set(selected) - set(available))
    if unknown:
        parser.error("unknown room(s): " + ", ".join(unknown))
    if args.local:
        args.remote = None
    if args.remote and not args.dry_run:
        probe = subprocess.run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", args.remote, "true"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if probe.returncode:
            print(f"{args.remote} is not answering (asleep or off the network). Wake it and run again; "
                  "nothing was rendered.", file=sys.stderr)
            return 2
    if args.remote:
        blender = ""
        remote_env = dict(os.environ, MORROW_HOST=args.remote)
        # MORROW_BLENDER means the local Blender here; remote_render.sh reads it as the remote one.
        remote_env.pop("MORROW_BLENDER", None)
        if os.environ.get("MORROW_REMOTE_BLENDER"):
            remote_env["MORROW_BLENDER"] = os.environ["MORROW_REMOTE_BLENDER"]
    elif not args.dry_run:
        blender = blender_path()
    else:
        blender = os.environ.get("MORROW_BLENDER", "blender")

    started = time.time()
    results: list[dict[str, object]] = []
    for room in selected:
        out = OUTPUTS / room
        log = LOGS / f"{room}.log"
        record: dict[str, object] = {"room": room, "status": "pending"}
        if not args.force and complete(out):
            print(f"[{room}] skipped: complete output exists")
            record["status"] = "skipped"
            results.append(record)
            continue
        began = time.time()
        try:
            if args.remote:
                print(f"[{room}] building here, rendering on {args.remote}, packing here")
                run(["bash", "tools/blender/remote_render.sh", room, "--samples", str(args.samples), "--scale", str(args.scale)],
                    log, args.dry_run, env=dict(remote_env, MORROW_OUT=str(out)))
            else:
                print(f"[{room}] building, rendering, and packing")
                # Blender exits 0 when its Python script raises unless told otherwise.
                run([blender, "-b", "--factory-startup", "--python-exit-code", "1", "-P", "tools/blender/build_room.py",
                     "--", room], log, args.dry_run)
                run([blender, "-b", str(BLENDS / f"{room}.blend"), "--python-exit-code", "1", "-P", "tools/blender/render_room.py",
                     "--", "--out", str(out), "--samples", str(args.samples), "--scale", str(args.scale)], log, args.dry_run)
            run([sys.executable, "tools/blender/pack_room.py", str(out), "--quality", str(args.quality),
                 "--light-quality", str(args.light_quality)], log, args.dry_run)
            if not args.dry_run and not complete(out):
                raise RuntimeError(f"finished without a complete room.json and passes; see {log}")
            record["status"] = "planned" if args.dry_run else "complete"
            if not args.dry_run:
                record["seconds"] = round(time.time() - began, 1)
                print(f"[{room}] done in {record['seconds']}s")
        except (OSError, RuntimeError) as error:
            record["status"] = "failed"
            record["error"] = str(error)
            results.append(record)
            print(f"[{room}] FAILED: {error}", file=sys.stderr)
            continue
        results.append(record)

    summary = {"rooms": results, "elapsedSeconds": round(time.time() - started, 1),
               "samples": args.samples, "scale": args.scale, "remote": args.remote}
    if not args.dry_run:
        SUMMARY.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(f"summary: {SUMMARY}")
    failed = [r for r in results if r["status"] == "failed"]
    print(f"finished: {len(results) - len(failed)} succeeded/skipped, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
