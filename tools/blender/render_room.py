"""Render a remastered room's passes and write its manifest.

    blender -b art/blender/rooms/hall.blend -P tools/blender/render_room.py -- \
        --out remastered/rooms/hall [--samples 512] [--scale 100]

For the base state and every variant it renders:
  beauty   Cycles, everything but the player's lantern (HDR, Reinhard-encoded)
  albedo   diffuse colour, what the lantern has to light
  normal   world normals, converted to three.js Y-up
  emit     self-lit surfaces
  data     R,G = planar depth packed to 16 bits, B = hotspot pass index
A variant is stored as a crop of every pass plus a mask, so the browser can
lay it over the base when the game state calls for it.

Writes raw PNGs and room.json; pack_room.py turns the PNGs into WebP.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from kit import TO_THREE  # noqa: E402

WIDTH, HEIGHT = 1280, 800
DEPTH_RANGE = 40.0     # metres mapped onto the 16-bit depth code
NEAR, FAR = 0.1, 60.0  # the three.js camera's clip planes


# ---------------------------------------------------------------- setup

def use_gpu(scene: bpy.types.Scene) -> str:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        (getattr(prefs, "refresh_devices", None) or prefs.get_devices)()
        found = [d for d in prefs.devices if d.type == kind]
        if found:
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            return kind
    scene.cycles.device = "CPU"
    return "CPU"


def has_oidn(scene: bpy.types.Scene) -> bool:
    """Distro builds of Blender often ship with no denoiser at all. The enum
    is filled in at run time, so the only reliable test is to try it."""
    try:
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        return False
    if hasattr(scene.cycles, "denoising_use_gpu"):
        scene.cycles.denoising_use_gpu = True
    return True


def configure(scene: bpy.types.Scene, scale: int) -> None:
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = scale
    scene.render.film_transparent = False
    scene.cycles.seed = 7
    scene.cycles.use_animated_seed = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.frame_current = 1
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.sample_clamp_indirect = 4.0
    scene.cycles.max_bounces = 6
    scene.cycles.volume_bounces = 1
    if hasattr(scene.cycles, "volume_step_rate"):   # gone from Blender 5's volume integrator
        scene.cycles.volume_step_rate = 4.0
    layer = scene.view_layers[0]
    layer.use_pass_combined = True
    layer.use_pass_diffuse_color = True
    layer.use_pass_normal = True
    layer.use_pass_emit = True


# Render-layer socket names that Blender 5 spelled out in full.
SOCKETS = {"DiffCol": "Diffuse Color", "Emit": "Emission"}


def outputs(scene: bpy.types.Scene, folder: str, slots: dict[str, str]) -> None:
    """Route render-layer sockets to EXR files: {file stem: socket name}.
    Blender 4 keeps the compositor on scene.node_tree with file slots;
    Blender 5 uses a node group with file output items."""
    if hasattr(scene, "compositing_node_group"):
        tree = scene.compositing_node_group or bpy.data.node_groups.new("morrow.passes", "CompositorNodeTree")
        scene.compositing_node_group = tree
    else:
        scene.use_nodes = True
        tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    out = tree.nodes.new("CompositorNodeOutputFile")
    if hasattr(out, "file_output_items"):
        out.directory = folder
        out.file_name = ""
        out.format.media_type = "IMAGE"
    else:
        comp = tree.nodes.new("CompositorNodeComposite")
        tree.links.new(rl.outputs["Image"], comp.inputs["Image"])
        out.base_path = folder
    out.format.file_format = "OPEN_EXR"
    out.format.color_depth = "32"
    out.format.exr_codec = "ZIP"
    items = out.file_output_items if hasattr(out, "file_output_items") else out.file_slots
    items.clear()
    for stem, socket in slots.items():
        if hasattr(out, "file_output_items"):
            items.new("RGBA", stem + "_")
        else:
            items.new(stem + "_")
        if socket not in rl.outputs:
            socket = SOCKETS.get(socket, socket)
        tree.links.new(rl.outputs[socket], out.inputs[stem + "_"])


def utility_material() -> bpy.types.Material:
    """Emission of (planar depth, pass index, 0): exact values, no lighting."""
    m = bpy.data.materials.new("morrow.utility")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    vt = nt.nodes.new("ShaderNodeVectorTransform")
    vt.vector_type = "POINT"
    vt.convert_from = "WORLD"
    vt.convert_to = "CAMERA"
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    absz = nt.nodes.new("ShaderNodeMath")
    absz.operation = "ABSOLUTE"
    info = nt.nodes.new("ShaderNodeObjectInfo")
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(geo.outputs["Position"], vt.inputs["Vector"])
    nt.links.new(vt.outputs["Vector"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], absz.inputs[0])
    nt.links.new(absz.outputs[0], comb.inputs["X"])
    nt.links.new(info.outputs["Object Index"], comb.inputs["Y"])
    nt.links.new(comb.outputs["Vector"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], outn.inputs["Surface"])
    return m


# ---------------------------------------------------------------- state

class State:
    """Applies a variant chain on top of the room's default state."""

    def __init__(self, meta: dict) -> None:
        self.meta = meta
        self.variants = {v["id"]: v for v in meta.get("variants", [])}
        self.rot = {o.name: tuple(o.rotation_euler) for o in bpy.data.objects}
        self.hidden = {o.name: o.hide_render for o in bpy.data.objects}

    def chain(self, vid: str | None) -> list[dict]:
        out: list[dict] = []
        while vid:
            v = self.variants[vid]
            out.insert(0, v)
            vid = v.get("base")
        return out

    def apply(self, vid: str | None) -> None:
        for o in bpy.data.objects:
            o.rotation_euler = self.rot[o.name]
            o.hide_render = self.hidden[o.name]
        for v in self.chain(vid):
            for name, deg in v.get("rotate", {}).items():
                bpy.data.objects[name].rotation_euler = [math.radians(a) for a in deg]
            for name in v.get("show", []):
                bpy.data.objects[name].hide_render = False
            for name in v.get("hide", []):
                bpy.data.objects[name].hide_render = True


# ---------------------------------------------------------------- rendering

def load_exr(folder: str, stem: str) -> np.ndarray:
    """Read and delete a pass. Blender 4 names it stem_0001.exr, Blender 5 stem_.exr."""
    found = sorted(f for f in os.listdir(folder) if f.startswith(stem + "_") and f.endswith(".exr"))
    if len(found) != 1:
        raise RuntimeError(f"expected one {stem} pass in {folder}, found {found}")
    path = os.path.join(folder, found[0])
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    os.remove(path)
    return px.reshape(h, w, 4)[::-1, :, :3].copy()   # top-down rows


def atrous(beauty: np.ndarray, albedo: np.ndarray, normal: np.ndarray, depth: np.ndarray, passes: int = 5) -> np.ndarray:
    """Edge-avoiding a-trous wavelet denoise, guided by normals and depth.

    Filters demodulated light (beauty / albedo) so texture detail survives,
    then puts the albedo back. A fallback for Blender builds without OIDN.
    """
    alb = np.maximum(albedo, 0.02)
    light = beauty / alb
    n = normal / np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
    kernel = (1 / 16, 1 / 4, 3 / 8, 1 / 4, 1 / 16)
    for level in range(passes):
        step = 1 << level
        acc = np.zeros_like(light)
        wsum = np.zeros(light.shape[:2] + (1,), dtype=np.float32)
        lum = light.mean(axis=2)
        sigma_l = 4.0 * max(float(np.std(lum)), 1e-3) / (level + 1)
        for j, ky in enumerate(kernel):
            dy = (j - 2) * step
            for i, kx in enumerate(kernel):
                dx = (i - 2) * step
                sl = np.roll(light, (dy, dx), axis=(0, 1))
                sn = np.roll(n, (dy, dx), axis=(0, 1))
                sd = np.roll(depth, (dy, dx), axis=(0, 1))
                wn = np.maximum((n * sn).sum(axis=2), 0.0) ** 64
                wd = np.exp(-np.abs(depth - sd) / (0.02 * depth + 0.01))
                wl = np.exp(-np.abs(lum - sl.mean(axis=2)) / sigma_l)
                w = (kx * ky * wn * wd * wl)[:, :, None].astype(np.float32)
                acc += sl * w
                wsum += w
        light = acc / np.maximum(wsum, 1e-6)
    return light * alb


def render_state(scene: bpy.types.Scene, meta: dict, work: str, samples: int, util_mat: bpy.types.Material,
                 oidn: bool) -> dict:
    layer = scene.view_layers[0]

    # Beauty and its lighting passes.
    scene.cycles.samples = samples
    scene.cycles.use_denoising = oidn
    scene.cycles.pixel_filter_type = "BLACKMAN_HARRIS"
    scene.cycles.filter_width = 1.5
    layer.material_override = None
    outputs(scene, work, {"beauty": "Image", "albedo": "DiffCol", "normal": "Normal", "emit": "Emit"})
    bpy.ops.render.render(write_still=False)
    passes = {k: load_exr(work, k) for k in ("beauty", "albedo", "normal", "emit")}

    # Exact depth and ids: one unfiltered sample, no lights, no fog.
    hidden = []
    for o in bpy.data.objects:
        if (o.type == "LIGHT" or o.name in meta.get("utilityHidden", [])) and not o.hide_render:
            o.hide_render = True
            hidden.append(o)
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.cycles.pixel_filter_type = "BOX"
    scene.cycles.filter_width = 0.01
    layer.material_override = util_mat
    outputs(scene, work, {"util": "Image"})
    bpy.ops.render.render(write_still=False)
    util = load_exr(work, "util")
    for o in hidden:
        o.hide_render = False
    layer.material_override = None
    passes["depth"] = util[:, :, 0]
    passes["ids"] = np.rint(util[:, :, 1]).astype(np.int32)
    if not oidn:
        passes["beauty"] = atrous(passes["beauty"], passes["albedo"], passes["normal"], passes["depth"])
    return passes


# ---------------------------------------------------------------- encoding

def srgb(lin: np.ndarray) -> np.ndarray:
    lin = np.clip(lin, 0.0, 1.0)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def hdr_code(lin: np.ndarray, exposure: float) -> np.ndarray:
    """Reinhard then sRGB: 8 bits that still hold highlights above 1."""
    c = np.maximum(lin, 0.0) * (2.0 ** exposure)
    return srgb(c / (1.0 + c))


def to_bytes(a: np.ndarray) -> np.ndarray:
    return np.clip(np.rint(a * 255.0), 0, 255).astype(np.uint8)


def encode(passes: dict, exposure: float) -> dict[str, np.ndarray]:
    n = passes["normal"]
    n = n / np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-6)
    n3 = np.stack([n[:, :, 0], n[:, :, 2], -n[:, :, 1]], axis=2)    # Blender Z-up -> three Y-up
    code = np.clip(passes["depth"] / DEPTH_RANGE, 0.0, 1.0)
    d16 = np.rint(code * 65535.0).astype(np.int32)
    data = np.stack([d16 >> 8, d16 & 255, np.clip(passes["ids"], 0, 255)], axis=2).astype(np.uint8)
    return {
        "beauty": to_bytes(hdr_code(passes["beauty"], exposure)),
        "albedo": to_bytes(srgb(passes["albedo"])),
        "normal": to_bytes(n3 * 0.5 + 0.5),
        "emit": to_bytes(hdr_code(passes["emit"], exposure)),
        "data": data,
    }


def save_png(path: str, arr: np.ndarray) -> None:
    h, w, c = arr.shape
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=(c == 4), float_buffer=False)
    img.colorspace_settings.name = "Non-Color"
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :c] = arr.astype(np.float32) / 255.0
    img.pixels.foreach_set(rgba[::-1].ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    out = mask.copy()
    for _ in range(r):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def variant_mask(base: dict, var: dict, enc_base: dict, enc_var: dict) -> np.ndarray:
    """Pixels the variant changes: geometry first, then the light and
    shadow that geometry casts nearby, ignoring sampling noise elsewhere."""
    geo = (base["ids"] != var["ids"]) | (np.abs(base["depth"] - var["depth"]) > 0.01)
    if not geo.any():
        return geo
    ys, xs = np.nonzero(geo)
    pad = 48
    y0, y1 = max(0, ys.min() - pad), min(geo.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(geo.shape[1], xs.max() + pad + 1)
    shade = np.zeros_like(geo)
    diff = np.abs(enc_base["beauty"].astype(np.int16) - enc_var["beauty"].astype(np.int16)).max(axis=2)
    shade[y0:y1, x0:x1] = diff[y0:y1, x0:x1] > 6
    return dilate(geo, 3) | dilate(shade, 1)


# ---------------------------------------------------------------- manifest

def camera_json(scene: bpy.types.Scene) -> dict:
    cam = scene.camera
    fov_h = 2 * math.atan(cam.data.sensor_width / 2 / cam.data.lens)
    fov_v = 2 * math.atan(math.tan(fov_h / 2) * HEIGHT / WIDTH)
    m = TO_THREE @ cam.matrix_world
    return {
        "matrix": [round(m[r][c], 6) for c in range(4) for r in range(4)],   # column-major
        "fov": round(math.degrees(fov_v), 4), "aspect": WIDTH / HEIGHT,
        "near": NEAR, "far": FAR, "depthRange": DEPTH_RANGE,
    }


def floor_point(p: list[float]) -> list[float]:
    return [round(p[0], 3), 0.0, round(-p[1], 3)]


def manifest(scene: bpy.types.Scene, meta: dict, variants: list[dict], exposure: float) -> dict:
    walk = meta.get("walk", {})
    rect = lambda r: [r[0], r[1], -r[3], -r[2]]  # noqa: E731  Blender y-range -> three z-range
    return {
        "room": meta["room"],
        "size": [WIDTH, HEIGHT],
        "camera": camera_json(scene),
        "passes": {k: f"{k}.webp" for k in ("beauty", "albedo", "normal", "emit", "data")},
        "ids": {str(v): k for k, v in meta["hotspots"].items()},
        "variants": variants,
        "walk": {"area": rect(walk["area"]), "blocks": [rect(b) for b in walk.get("blocks", [])]},
        "points": {k: floor_point(v) for k, v in meta.get("points", {}).items()},
        "walkTo": {k: floor_point(v) for k, v in meta.get("walkTo", {}).items()},
        "zones": meta.get("zones", []),
        # Things the shell draws live over the render, placed in three.js coordinates.
        "live": {k: dict(v, at=[round(v["at"][0], 3), round(v["at"][2], 3), round(-v["at"][1], 3)])
                 for k, v in meta.get("live", {}).items()},
        "lights": meta.get("lights", {}),
        "music": meta.get("music"),
        "wake": meta.get("wake", "change"),
        "exposure": exposure,
    }


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--samples", type=int, default=512)
    ap.add_argument("--scale", type=int, default=100)
    ap.add_argument("--exposure", type=float, default=None)
    ap.add_argument("--only", default=None, help="render just 'base' or one variant id")
    args = ap.parse_args(argv)

    scene = bpy.context.scene
    meta = json.loads(scene["morrow"])
    exposure = args.exposure if args.exposure is not None else meta.get("exposure", 0.0)
    device = use_gpu(scene)
    oidn = has_oidn(scene)
    configure(scene, args.scale)
    out = os.path.abspath(args.out)
    work = os.path.join(out, "_work")
    os.makedirs(work, exist_ok=True)
    print(f"[morrow] {meta['room']}: {device}, {args.samples} samples, {args.scale}%, "
          f"denoise {'OIDN' if oidn else 'a-trous'}")

    state = State(meta)
    util_mat = utility_material()
    rendered: dict[str | None, dict] = {}
    encoded: dict[str | None, dict] = {}

    def get(vid: str | None) -> tuple[dict, dict]:
        if vid not in rendered:
            state.apply(vid)
            started = time.time()
            rendered[vid] = render_state(scene, meta, work, args.samples, util_mat, oidn)
            print(f"[morrow] state {vid or 'base'} rendered in {time.time() - started:.0f}s")
            encoded[vid] = encode(rendered[vid], exposure)
        return rendered[vid], encoded[vid]

    _, enc = get(None)
    for name, arr in enc.items():
        save_png(os.path.join(out, name + ".png"), arr)

    entries = []
    for v in meta.get("variants", []):
        if args.only and args.only not in (v["id"], "all"):
            continue
        base, enc_base = get(v.get("base"))
        var, enc_var = get(v["id"])
        mask = variant_mask(base, var, enc_base, enc_var)
        if not mask.any():
            print(f"[morrow] variant {v['id']} changes nothing visible; skipped")
            continue
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        alpha = to_bytes(mask[y0:y1, x0:x1].astype(np.float32))[:, :, None]
        stem = "v." + v["id"]
        for name, arr in enc_var.items():
            crop = arr[y0:y1, x0:x1]
            if name in ("beauty", "data"):
                crop = np.concatenate([crop, alpha], axis=2)
            save_png(os.path.join(out, f"{stem}.{name}.png"), crop)
        s = args.scale / 100
        entries.append({
            "id": v["id"], "when": v.get("when", {}),
            "rect": [int(x0 / s), int(y0 / s), int((x1 - x0) / s), int((y1 - y0) / s)],
            "passes": {k: f"{stem}.{k}.webp" for k in ("beauty", "albedo", "normal", "emit", "data")},
        })
        print(f"[morrow] variant {v['id']}: {x1 - x0}x{y1 - y0} at {x0},{y0}")

    with open(os.path.join(out, "room.json"), "w") as f:
        json.dump(manifest(scene, meta, entries, exposure), f, indent=1)
    os.rmdir(work) if not os.listdir(work) else None
    print(f"[morrow] wrote {out}")


if __name__ == "__main__":     # blender -P runs it as __main__; the epilogue imports its setup
    main()
