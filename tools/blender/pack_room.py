"""Turn a rendered room's raw PNG passes into the WebP files the browser loads.

    python3 tools/blender/pack_room.py remastered/rooms/hall [--quality 84] [--light-quality 72] [--keep-png]

Picture passes go lossy. The beauty pass is what the player looks at and
keeps --quality; the passes the lantern relights (albedo, normal, emit)
are only ever seen through the light and take --light-quality, about 40%
smaller with no visible difference. The data pass holds packed depth and
hotspot ids and must stay byte-exact, so it goes lossless. Variant
overlays keep their alpha mask, losslessly, in every case.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

EXACT = ("data",)


def pack(folder: Path, quality: int, light_quality: int, keep: bool) -> int:
    total = 0
    for png in sorted(folder.glob("*.png")):
        kind = png.stem.split(".")[-1]
        dest = png.with_suffix(".webp")
        img = Image.open(png)
        if kind in EXACT:
            img.save(dest, "WEBP", lossless=True, quality=100, method=6, exact=True)
        else:
            q = quality if kind == "beauty" else light_quality
            img.save(dest, "WEBP", quality=q, method=6, alpha_quality=100, exact=True)
        size = dest.stat().st_size
        total += size
        print(f"{dest.name:32} {size / 1024:7.1f} KB")
        if not keep:
            png.unlink()
    return total


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("--quality", type=int, default=84)
    ap.add_argument("--light-quality", type=int, default=72)
    ap.add_argument("--keep-png", action="store_true")
    args = ap.parse_args()
    total = pack(args.folder, args.quality, args.light_quality, args.keep_png)
    print(f"{'total':32} {total / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
