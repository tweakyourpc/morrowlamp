#!/usr/bin/env python3
"""Assemble the public website: the Workshop, the classic editions and the remaster.

    python3 tools/publish_site.py [--out dist]

Copies only what the pages load (the four public pages, js/, css/, the
remastered/ asset tier) plus LICENSE and CREDITS.md into a static folder.
Blender sources, tools, tests, docs, marketing and agent notes stay behind.
Then it checks that every local file a page names in src or href, every
pass a room manifest lists, and every voice clip an index lists is present,
and fails if one is missing.

The result is plain static files: drag the folder onto Netlify Drop, or let
Netlify run this script itself through netlify.toml.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "text.html", "author.html", "remastered.html"]
FOLDERS = ["js", "css", "remastered"]
FILES = ["LICENSE", "CREDITS.md"]
SKIP = shutil.ignore_patterns("__pycache__", "*.py", "*.pyc", ".DS_Store", "*.blend", "*.blend1", "*.png")
REF = re.compile(r'(?:src|href)="([^"#?]+)"')
# Folder names that upload tools treat as build output or dependencies and
# quietly leave out. Netlify Drop dropped js/vendor/three/build/ this way.
UPLOAD_SKIPS = {"build", "node_modules", "dist", "out", "target", "vendor_cache"}


def build(out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for name in PAGES + FILES:
        shutil.copy2(ROOT / name, out / name)
    for folder in FOLDERS:
        shutil.copytree(ROOT / folder, out / folder, ignore=SKIP)


def missing(out: Path) -> list[str]:
    problems = []
    for page in PAGES:
        for ref in REF.findall((out / page).read_text(encoding="utf-8")):
            if "://" in ref or ref.startswith(("mailto:", "data:")):
                continue
            if not (out / ref).exists():
                problems.append(f"{page} names {ref}")
    for manifest in sorted((out / "remastered" / "rooms").glob("*/room.json")):
        room = json.loads(manifest.read_text())
        files = list(room["passes"].values()) + [f for v in room.get("variants", []) for f in v["passes"].values()]
        problems += [f"{manifest.parent.name} names {f}" for f in files if not (manifest.parent / f).exists()]
    voice = out / "remastered" / "voice"
    index = json.loads((voice / "index.json").read_text())
    for narrator, info in index["narrators"].items():
        lines = json.loads((voice / info["lines"]).read_text())
        problems += [f"{narrator} names {c['file']}" for c in lines.values() if not (voice / narrator / c["file"]).exists()]
    for need in ["remastered/actors/hero.glb", "js/vendor/three/three.core.min.js", "js/vendor/three/three.module.min.js"]:
        if not (out / need).exists():
            problems.append(f"the remaster needs {need}")
    for folder in (p for p in out.rglob("*") if p.is_dir() and p.name in UPLOAD_SKIPS):
        problems.append(f"{folder.relative_to(out)} is a folder name uploaders skip; rename it")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=ROOT / "dist")
    args = ap.parse_args()
    out = args.out.resolve()
    build(out)
    problems = missing(out)
    files = [p for p in out.rglob("*") if p.is_file()]
    size = sum(p.stat().st_size for p in files)
    for p in problems:
        print("MISSING", p)
    print(f"{out}: {len(files)} files, {size / 1024 / 1024:.1f} MB" + (f", {len(problems)} missing" if problems else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
