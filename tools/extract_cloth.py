#!/usr/bin/env python3
"""Turns photographs of real cloth and leather into the small pictures the
soldiers' uniforms are made from (src/actors/clothPhotoData.js).

The photographs are scans released under CC0 1.0 (public domain), taken from
the Render 3D Library collection, which names each one's source:

    wool     Fabric.Felt.Grey.01       ambientCG Fabric034, by Lennart Demes
    cotton   Fabric.Linen.Blue.01      Poly Haven rough_linen, by colormass and Rico Cilliers
    canvas   Fabric.Canvas.Natural.01  Poly Haven hessian_380, by colormass and Rico Cilliers
    leather  Leather.Brown.Worn.01     ambientCG Leather014, by Lennart Demes

    git clone --depth 1 https://github.com/RezLala/Render3DLibrary
    python3 tools/extract_cloth.py Render3DLibrary/Textures

Each scan repeats without a seam and comes as a color picture and a picture of
which way the surface faces. The game only wants two things of it, since the
color of a uniform is the game's own: how much lighter or darker than its
middle the cloth is at each point (128 = the middle), and how high the surface
stands (worked out from the facing picture). Both go side by side into one
grey WebP picture a material, 384 points square each.
"""
import base64
import io
import os
import sys

import numpy as np
from PIL import Image

src = sys.argv[1] if len(sys.argv) > 1 else 'Render3DLibrary/Textures'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'src', 'actors', 'clothPhotoData.js')

# name, file, how much of the scan's broad light and dark patches to keep (a
# patch that comes round again every tile shows as a pattern), picture quality.
SETS = [
    ('wool', 'Fabric/Fabric.Felt.Grey.01', 0.45, 70),
    ('cotton', 'Fabric/Fabric.Linen.Blue.01', 0.4, 70),
    ('canvas', 'Fabric/Fabric.Canvas.Natural.01', 0.4, 68),
    ('leather', 'Leather/Leather.Brown.Worn.01', 0.35, 72),
]
N, S = 1024, 384


def load(path):
    return np.asarray(Image.open(path).convert('RGB').resize((N, N), Image.LANCZOS), np.float64) / 255


def freq():
    k = np.fft.fftfreq(N) * N  # whole waves a tile
    return np.meshgrid(k, k)


def half(a):
    """Down to S points square (wrapped round first, so the edges still meet)."""
    pad = 64
    big = np.pad(a, pad, mode='wrap')
    k = S / N
    im = Image.fromarray(big.astype(np.float32), 'F').resize((round(big.shape[1] * k), round(big.shape[0] * k)), Image.LANCZOS)
    c = round(pad * k)
    return np.asarray(im, np.float64)[c : c + S, c : c + S]


chunks = []
for name, base, broad, quality in SETS:
    rgb = load(os.path.join(src, base + '.Color.1K.jpg'))
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722])
    f = lum / lum.mean()
    # Broad patches (longer than a third of the tile) toned down.
    kx, ky = freq()
    kk = np.hypot(kx, ky)
    keep = broad + (1 - broad) * (1 - np.exp(-((kk / 3.0) ** 2)))
    keep[0, 0] = 1
    f = np.fft.ifft2(np.fft.fft2(f) * keep).real
    shade = np.clip(half(f) * 0.5, 0, 1)

    # Height from the facing picture: the surface whose slopes these are (the
    # scan repeats, so this is exact in waves). The picture's green may point up
    # or down the image; the right way is the one whose slopes fit a surface.
    n = load(os.path.join(src, base + '.Normal.1K.jpg')) * 2 - 1
    nz = np.maximum(n[..., 2], 0.2)
    gx = -n[..., 0] / nz
    best = None
    for sign in (1, -1):
        gr = sign * n[..., 1] / nz
        GX, GR = np.fft.fft2(gx - gx.mean()), np.fft.fft2(gr - gr.mean())
        wx, wr = 2j * np.pi * kx / N, 2j * np.pi * ky / N
        den = (wx * np.conj(wx) + wr * np.conj(wr)).real
        den[0, 0] = 1
        H = (np.conj(wx) * GX + np.conj(wr) * GR) / den
        H[0, 0] = 0
        h = np.fft.ifft2(H).real
        # What is left of the slopes once the surface's own are taken away.
        left = np.abs(GX - wx * H) ** 2 + np.abs(GR - wr * H) ** 2
        score = left.sum() / (np.abs(GX) ** 2 + np.abs(GR) ** 2).sum()
        if best is None or score < best[0]:
            best = (score, h, sign)
    score, h, sign = best
    # (Without its broad swells: cloth lies flat on the man, and they would
    # use up the picture's 256 steps on what gives no shading.)
    h = np.fft.ifft2(np.fft.fft2(h) * (1 - np.exp(-((kk / 8.0) ** 2)))).real
    h = half(h) / N  # in tile widths
    lo, hi = np.percentile(h, 0.2), np.percentile(h, 99.8)
    height = np.clip((h - lo) / (hi - lo), 0, 1)

    both = np.concatenate([shade, height], axis=1)
    buf = io.BytesIO()
    Image.fromarray(np.round(both * 255).astype(np.uint8), 'L').save(buf, 'WEBP', quality=quality, method=6)
    data = buf.getvalue()
    chunks.append((name, base, hi - lo, data))
    print('%-8s %s  shade %.2f..%.2f  height range %.5f of a tile  (fit %.3f, green %s)  %d KB' % (name, base, shade.min() * 2, shade.max() * 2, hi - lo, score, 'up' if sign > 0 else 'down', len(data) // 1024))

with open(out, 'w') as f:
    f.write('// Photographs of real cloth and leather for the soldiers\' uniforms, made by\n')
    f.write('// tools/extract_cloth.py from CC0 (public domain) scans by ambientCG and Poly Haven,\n')
    f.write('// as collected in github.com/RezLala/Render3DLibrary. Not written by hand.\n')
    f.write('// Each is a grey WebP picture of two squares side by side: on the left how light the cloth\n')
    f.write('// is against its own middle (128 = the middle, 255 = twice as light), on the right\n')
    f.write('// how high its surface stands (0..255 over `range`, in widths of the tile).\n')
    f.write('export const CLOTH_PHOTOS = {\n')
    for name, base, rng, data in chunks:
        f.write("  %s: {\n    from: '%s',\n    size: %d,\n    range: %.6f,\n    webp: '%s',\n  },\n" % (name, base.split('/')[1], S, rng, base64.b64encode(data).decode()))
    f.write('};\n')
print('-> %s (%d KB)' % (out, os.path.getsize(out) // 1024))
