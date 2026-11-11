#!/usr/bin/env python3
"""Generate the crumpled-paper lighting textures used by the mobile TopoCard.

The web mockup lights an SVG ``feTurbulence`` (fractalNoise, 4 octaves)
height map with ``feDiffuseLighting`` (distant light, azimuth 225deg,
elevation 58deg) and multiplies it over the paper. react-native-svg has no
such filters, so this script bakes the same look into four PNGs:

1. fractal value noise (4 octaves) plus a few straight folds -> height map;
2. Sobel normals scaled by ``surface_scale`` -> directional diffuse lighting;
3. the deviation from a flat sheet is stored as black (shade) or white
   (highlight) pixels whose alpha carries the strength. A flat area stays
   fully transparent, so the paper colour (and text contrast) is preserved.

Output: apps/mobile/assets/textures/paper-0.png ... paper-3.png (palette PNG,
512x512). Deterministic: the same seeds always produce the same files.

Usage (repository root, needs numpy + Pillow):
    python scripts/generate-paper-textures.py
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
OUT_DIR = Path(__file__).resolve().parent.parent / "apps" / "mobile" / "assets" / "textures"

# Lighting, mirrored from the mockup filter.
AZIMUTH = math.radians(225)
ELEVATION = math.radians(58)
LIGHT = np.array([
    math.cos(AZIMUTH) * math.cos(ELEVATION),
    math.sin(AZIMUTH) * math.cos(ELEVATION),
    math.sin(ELEVATION),
])
FLAT = LIGHT[2]

# Strength caps: shades stay faint so text keeps >= 4.5:1 on every surface.
MAX_SHADE_ALPHA = 0.10
MAX_LIGHT_ALPHA = 0.30
LEVELS = 10  # Alpha steps per tone (palette PNG keeps files small).

VARIANTS = [
    # seed, base cells across the sheet, surface scale, folds
    (3, 11, 9.0, 16),
    (11, 12, 8.0, 19),
    (23, 13, 10.0, 15),
    (41, 10, 9.0, 21),
]


def value_noise(rng: np.random.Generator, cells: int) -> np.ndarray:
    """One octave: random lattice upsampled with bicubic interpolation."""
    lattice = rng.random((cells + 3, cells + 3)).astype(np.float32)
    image = Image.fromarray(lattice, mode="F")
    pad = SIZE / cells
    full = int(round(pad * (cells + 3)))
    big = np.asarray(image.resize((full, full), Image.BICUBIC), dtype=np.float32)
    offset = int(round(pad))
    return big[offset:offset + SIZE, offset:offset + SIZE]


def folds(rng: np.random.Generator, count: int) -> np.ndarray:
    """Creases: straight V-shaped ridges/valleys fading out along their length."""
    ys, xs = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    height = np.zeros((SIZE, SIZE), dtype=np.float32)
    for _ in range(count):
        angle = rng.uniform(0, math.pi)
        cx, cy = rng.uniform(0, 1, 2) * SIZE
        tx, ty = math.cos(angle), math.sin(angle)
        across = np.abs((xs - cx) * -ty + (ys - cy) * tx)
        along = np.abs((xs - cx) * tx + (ys - cy) * ty)
        length = rng.uniform(0.25, 0.9) * SIZE
        width = rng.uniform(6, 22)
        depth = rng.uniform(0.4, 1.0) * (1 if rng.random() < 0.5 else -1)
        fade = np.clip(1 - along / length, 0, 1) ** 0.7
        height += depth * width * np.clip(1 - across / width, 0, 1) * fade
    return height / 90


def texture(seed: int, cells: int, surface_scale: float, fold_count: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    height = np.zeros((SIZE, SIZE), dtype=np.float32)
    amplitude, total = 1.0, 0.0
    for octave in range(4):
        height += amplitude * value_noise(rng, cells * 2 ** octave)
        total += amplitude
        amplitude *= 0.5
    height /= total
    height = 0.5 * height + folds(rng, fold_count)

    # Sobel gradients (per pixel), like feDiffuseLighting's normal kernel.
    padded = np.pad(height, 1, mode="edge")
    gx = (
        (padded[:-2, 2:] + 2 * padded[1:-1, 2:] + padded[2:, 2:])
        - (padded[:-2, :-2] + 2 * padded[1:-1, :-2] + padded[2:, :-2])
    ) / 4
    gy = (
        (padded[2:, :-2] + 2 * padded[2:, 1:-1] + padded[2:, 2:])
        - (padded[:-2, :-2] + 2 * padded[:-2, 1:-1] + padded[:-2, 2:])
    ) / 4
    nx, ny, nz = -surface_scale * gx, -surface_scale * gy, np.ones_like(gx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    lit = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / norm
    deviation = lit - FLAT

    # Normalise so the strongest ~1% of creases reach the alpha caps.
    shade = np.clip(-deviation / np.percentile(-deviation, 99.2), 0, 1)
    light = np.clip(deviation / np.percentile(deviation, 99.2), 0, 1)
    shade_q = np.round(shade * LEVELS).astype(np.uint8)
    light_q = np.round(light * LEVELS).astype(np.uint8)

    # Palette: index 0 transparent, 1..LEVELS shades, LEVELS+1.. highlights.
    indices = np.where(shade_q > 0, shade_q, np.where(light_q > 0, LEVELS + light_q, 0)).astype(np.uint8)
    palette, alphas = [0, 0, 0], [0]
    for level in range(1, LEVELS + 1):
        palette += [0, 0, 0]
        alphas.append(round(255 * MAX_SHADE_ALPHA * level / LEVELS))
    for level in range(1, LEVELS + 1):
        palette += [255, 255, 255]
        alphas.append(round(255 * MAX_LIGHT_ALPHA * level / LEVELS))

    image = Image.fromarray(indices, mode="P")
    image.putpalette(palette)
    image.info["transparency"] = bytes(alphas)
    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for index, (seed, cells, scale, fold_count) in enumerate(VARIANTS):
        target = OUT_DIR / f"paper-{index}.png"
        image = texture(seed, cells, scale, fold_count)
        image.save(target, optimize=True, transparency=image.info["transparency"])
        print(f"{target.relative_to(OUT_DIR.parent.parent.parent.parent)}: {target.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
