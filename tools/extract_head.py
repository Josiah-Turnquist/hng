#!/usr/bin/env python3
"""Cuts the head and neck out of the MakeHuman base mesh and writes them, with
the shapes that vary a face and the colors of MakeHuman's skins, to
src/actors/headMeshData.js.

MakeHuman's base mesh, targets, skeleton, weights, skins and proxies are
released under CC0 1.0 (github.com/makehumancommunity/makehuman, LICENSE.md
part C; the skins are marked "public domain" on the images themselves).
Nothing of MakeHuman's program is used, only that data.

    git clone --depth 1 https://github.com/makehumancommunity/makehuman
    npm pack makehuman-data && tar -xzf makehuman-data-*.tgz      # skins, eyebrows, hair
    pip install numpy pillow pyfqmr
    python3 tools/extract_head.py makehuman/makehuman/data package/public/data

Written out: the head of a young man of average build (the caucasian one; the
asian and african ones as offsets from it), as it stands in MakeHuman (metres
from the point between the eyes); targets that change one feature each (nose,
chin, cheeks, lips, eyes, ears, fat), as offsets; for each vertex how much it
is of the head rather than the neck, of the jaw, under an eyebrow, under short
hair; its color in each of three skins, relative to that skin's middle tone
(so the game can put any skin tone under it); and a coarse version for the
middle distance, made of some of the same vertices.
"""
import base64
import json
import os
import struct
import sys

import numpy as np
import pyfqmr
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mh import Base, triangles  # noqa: E402

data = sys.argv[1]
extra = sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'actors', 'headMeshData.js')
Q = 20000  # steps a metre (0.05 mm)

b = Base(data)
M = 'targets/macrodetails/'
eth = {k: b.target('%s%s-male-young.target' % (M, k)) for k in ('caucasian', 'asian', 'african')}
b.apply(b.target(M + 'universal-male-young-averagemuscle-averageweight.target'))
b.apply(eth['caucasian'])
V = b.V

# --- which vertices -----------------------------------------------------------
head_bones = set(b.subtree('head'))
jaw_bones = set(b.subtree('jaw'))
neck_bones = {'neck01', 'neck02', 'neck03'}
share = lambda i, names: sum(w for n, w in b.weights.get(i, {}).items() if n in names)
neck0 = b.bone('neck01')[0]
keep = lambda i: share(i, head_bones | neck_bones) > 0.2 and V[i][1] > neck0[1] - 0.03 and abs(V[i][0]) < 0.12
faces = [f for f in b.F if all(keep(c[0]) for c in f)]
used = sorted({c[0] for f in faces for c in f})
local = {i: n for n, i in enumerate(used)}
n = len(used)
tris = triangles([[local[c[0]] for c in f] for f in faces], [V[i] for i in used])
uv_of = {}
for f in faces:
    for vi, ti in f:
        uv_of.setdefault(vi, ti)

eyeL, eyeR = sorted(b.G['helper-l-eye']), sorted(b.G['helper-r-eye'])
mean = lambda idx, src=None: [sum((src or V)[i][k] for i in idx) / len(idx) for k in range(3)]
cL, cR = mean(eyeL), mean(eyeR)
origin = [(cL[k] + cR[k]) / 2 for k in range(3)]
radius = sum(sum((V[i][k] - cL[k]) ** 2 for k in range(3)) ** 0.5 for i in eyeL) / len(eyeL)

# --- the shapes that vary a face ----------------------------------------------
T = 'targets/'
both = lambda p: [T + p.replace('*', 'l'), T + p.replace('*', 'r')]
TARGETS = {
    'asian': None,
    'african': None,
    'fat+': [T + 'head/head-fat-incr.target'],
    'fat-': [T + 'head/head-fat-decr.target'],
    'square': [T + 'head/head-square.target'],
    'oval': [T + 'head/head-oval.target'],
    'age+': [T + 'head/head-age-incr.target'],
    'chinWidth+': [T + 'chin/chin-width-incr.target'],
    'chinWidth-': [T + 'chin/chin-width-decr.target'],
    'chinOut+': [T + 'chin/chin-prominent-incr.target'],
    'chinOut-': [T + 'chin/chin-prominent-decr.target'],
    'chinHeight+': [T + 'chin/chin-height-incr.target'],
    'chinHeight-': [T + 'chin/chin-height-decr.target'],
    'jaw+': [T + 'chin/chin-jaw-drop-incr.target'],
    'jaw-': [T + 'chin/chin-jaw-drop-decr.target'],
    'nose+': [T + 'nose/nose-volume-incr.target'],
    'nose-': [T + 'nose/nose-volume-decr.target'],
    'noseWidth+': [T + 'nose/nose-scale-horiz-incr.target'],
    'noseWidth-': [T + 'nose/nose-scale-horiz-decr.target'],
    'noseLength+': [T + 'nose/nose-scale-vert-incr.target'],
    'noseLength-': [T + 'nose/nose-scale-vert-decr.target'],
    'noseHump+': [T + 'nose/nose-hump-incr.target'],
    'noseHump-': [T + 'nose/nose-hump-decr.target'],
    'nosePoint+': [T + 'nose/nose-point-up.target'],
    'nosePoint-': [T + 'nose/nose-point-down.target'],
    'cheekBones+': both('cheek/*-cheek-bones-incr.target'),
    'cheekBones-': both('cheek/*-cheek-bones-decr.target'),
    'cheeks+': both('cheek/*-cheek-volume-incr.target'),
    'cheeks-': both('cheek/*-cheek-volume-decr.target'),
    'mouthWidth+': [T + 'mouth/mouth-scale-horiz-incr.target'],
    'mouthWidth-': [T + 'mouth/mouth-scale-horiz-decr.target'],
    'lips+': [T + 'mouth/mouth-lowerlip-volume-incr.target', T + 'mouth/mouth-upperlip-volume-incr.target'],
    'lips-': [T + 'mouth/mouth-lowerlip-volume-decr.target', T + 'mouth/mouth-upperlip-volume-decr.target'],
    'eyes+': both('eyes/*-eye-scale-incr.target'),
    'eyes-': both('eyes/*-eye-scale-decr.target'),
    'eyesApart+': both('eyes/*-eye-trans-out.target'),
    'eyesApart-': both('eyes/*-eye-trans-in.target'),
    'eyeFold': both('eyes/*-eye-eyefold-down.target') + both('eyes/*-eye-epicanthus-in.target'),
    'brow+': [T + 'forehead/forehead-nubian-incr.target'],
    'brow-': [T + 'forehead/forehead-nubian-decr.target'],
    'ears+': both('ears/*-ear-scale-incr.target'),
    'ears-': both('ears/*-ear-scale-decr.target'),
    'earsOut+': both('ears/*-ear-wing-incr.target'),
    'earsOut-': both('ears/*-ear-wing-decr.target'),
}


def offsets(name, files):
    if files is None:  # the other peoples' heads, as offsets from the caucasian one
        o = {}
        for i in set(eth[name]) | set(eth['caucasian']):
            a, c = eth[name].get(i, [0, 0, 0]), eth['caucasian'].get(i, [0, 0, 0])
            o[i] = [a[k] - c[k] for k in range(3)]
        return o
    o = {}
    for f in files:
        for i, d in b.target(f).items():
            p = o.setdefault(i, [0, 0, 0])
            for k in range(3):
                p[k] += d[k]
    return o


target_meta, target_blob = [], b''
for name, files in TARGETS.items():
    o = offsets(name, files)
    rows = [(local[i], d) for i, d in sorted(o.items()) if i in local and max(abs(x) for x in d) > 0.00008]
    big = max((max(abs(x) for x in d) for _, d in rows), default=0.001)
    scale = big / 127
    eye = lambda idx: [round(sum(o.get(i, [0, 0, 0])[k] for i in idx) / len(idx), 6) for k in range(3)]
    target_meta.append([name, round(scale, 9), len(rows), eye(eyeL), eye(eyeR)])
    target_blob += b''.join(struct.pack('<H', i) for i, _ in rows)
    target_blob += b''.join(struct.pack('<3b', *[max(-127, min(127, round(x / scale))) for x in d]) for _, d in rows)

# --- what each vertex is --------------------------------------------------------
proxy = lambda path: json.load(open(os.path.join(extra, 'proxies', path)))['ref_vIdxs']


def mask(refs, full=2):
    count = {}
    for tri in refs:
        for i in tri:
            count[i] = count.get(i, 0) + 1
    return bytes(min(255, round(255 * count.get(i, 0) / full)) for i in used)


head_w = bytes(round(255 * min(1, share(i, head_bones) / max(1e-6, share(i, head_bones | neck_bones)))) for i in used)
jaw_w = bytes(round(255 * min(1, share(i, jaw_bones))) for i in used)
brow_m = mask(proxy('eyebrows/eyebrow001/eyebrow001.json'))
hair_m = mask(proxy('hair/short01/short01.json'), 1)

# --- the skins' colors ----------------------------------------------------------
SKINS = ['young_caucasian_male/textures/young_lightskinned_male_diffuse.png', 'young_asian_male/textures/young_lightskinned_male_diffuse3.png', 'young_african_male/textures/young_darkskinned_male_diffuse.png']
colors = np.zeros((n, 9), np.uint8)
Pn = np.array([V[i] for i in used])
area = np.zeros(n)
for t in tris:
    a3 = 0.5 * np.linalg.norm(np.cross(Pn[t[1]] - Pn[t[0]], Pn[t[2]] - Pn[t[0]])) / 3
    for i in t:
        area[i] += a3
for s, path in enumerate(SKINS):
    im = np.asarray(Image.open(os.path.join(extra, 'skins', path)).convert('RGB'), np.float32) / 255
    # (sRGB to linear: the game's colors are linear.)
    im = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)
    H, W = im.shape[:2]
    px = np.zeros((n, 3), np.float32)
    for k, i in enumerate(used):
        u, v = b.VT[uv_of[i]]
        x, y = u * W - 0.5, (1 - v) * H - 0.5
        x0, y0 = int(np.floor(x)), int(np.floor(y))
        fx, fy = x - x0, y - y0
        at = lambda xx, yy: im[min(H - 1, max(0, yy)), min(W - 1, max(0, xx))]
        px[k] = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
    # The middle tone: of the face itself (brow to chin, forward of the ears),
    # each vertex counted by the skin it stands for, so the many small faces
    # round the eyes and inside the mouth don't decide it.
    face = np.array([head_w[k] > 230 and V[i][2] - origin[2] > -0.045 and abs(V[i][1] - origin[1] + 0.03) < 0.07 for k, i in enumerate(used)])
    middle = np.zeros(3)
    for c in range(3):
        o = np.argsort(px[face, c])
        cw = np.cumsum(area[face][o])
        middle[c] = px[face, c][o][np.searchsorted(cw, cw[-1] / 2)]
    colors[:, s * 3 : s * 3 + 3] = np.clip(np.round(px / middle * 128), 0, 255).astype(np.uint8)

# --- a coarse version for the middle distance -----------------------------------
P = np.array([V[i] for i in used], np.float64)
simp = pyfqmr.Simplify()
simp.setMesh(P, np.array(tris, np.int32))
simp.simplify_mesh(target_count=820, aggressiveness=6, preserve_border=True, verbose=False)
v1, f1, _ = simp.getMesh()
src = [int(np.argmin(((P - p) ** 2).sum(axis=1))) for p in v1]
order = sorted(set(src))
slot = {s: k for k, s in enumerate(order)}
tris1 = [[slot[src[i]] for i in f] for f in f1]
tris1 = [t for t in tris1 if len(set(t)) == 3]

# --- written out ------------------------------------------------------------------
b64 = lambda x: base64.b64encode(x).decode()
pos = b''.join(struct.pack('<3h', *[round((V[i][k] - origin[k]) * Q) for k in range(3)]) for i in used)
rel = lambda p: [round(p[k] - origin[k], 5) for k in range(3)]
with open(out, 'w') as f:
    f.write('// A head and neck, cut from the MakeHuman base mesh, with its targets and skins\n')
    f.write('// (CC0 1.0: github.com/makehumancommunity/makehuman) by tools/extract_head.py.\n')
    f.write('// Not written by hand: run the tool to change it. As it stands in MakeHuman\n')
    f.write('// (metres from the point between the eyes, facing +Z): fitted in headMesh.js.\n')
    f.write('export const HEAD_DATA = {\n')
    f.write('  steps: %d, // positions: this many steps a metre, int16 x, y, z\n' % Q)
    f.write('  vertices: %d,\n  triangles: %d,\n  coarseVertices: %d,\n  coarseTriangles: %d,\n' % (n, len(tris), len(order), len(tris1)))
    f.write('  // The eyes: [left centre, right centre, radius]; the joints of the head and the neck\'s base.\n')
    f.write('  eyes: %s,\n' % json.dumps([rel(cL), rel(cR), round(radius, 5)]))
    f.write('  joints: %s,\n' % json.dumps({'head': rel(b.bone('head')[0]), 'neck': rel(neck0), 'top': round(max(V[i][1] for i in used) - origin[1], 5)}))
    f.write('  // [name, metres a step, vertices moved, the left eye\'s move, the right eye\'s]\n')
    f.write('  targets: %s,\n' % json.dumps(target_meta))
    f.write("  // each target's vertices (uint16) then their moves (int8 x, y, z), one after another\n")
    f.write("  targetData: '%s',\n" % b64(target_blob))
    f.write("  positions: '%s',\n" % b64(pos))
    f.write("  index: '%s',\n" % b64(b''.join(struct.pack('<3H', *t) for t in tris)))
    f.write("  // the coarse version: which vertices (uint16), and its triangles over those\n")
    f.write("  coarse: '%s',\n" % b64(b''.join(struct.pack('<H', i) for i in order)))
    f.write("  coarseIndex: '%s',\n" % b64(b''.join(struct.pack('<3H', *t) for t in tris1)))
    f.write("  // a byte a vertex: of the head (not the neck), of the jaw, under a brow, under short hair\n")
    f.write("  head: '%s',\n  jaw: '%s',\n  brow: '%s',\n  hair: '%s',\n" % (b64(head_w), b64(jaw_w), b64(brow_m), b64(hair_m)))
    f.write("  // nine bytes a vertex: its color in the caucasian, asian and african skins, 128 = that skin's middle tone\n")
    f.write("  colors: '%s',\n" % b64(colors.tobytes()))
    f.write('};\n')
print('head: %d vertices, %d triangles; coarse %d, %d; %d targets -> %s (%d KB)' % (n, len(tris), len(order), len(tris1), len(TARGETS), out, os.path.getsize(out) // 1024))
