#!/usr/bin/env python3
"""Cuts the right hand out of the MakeHuman base mesh and writes it, with its
bones and skin weights, to src/actors/handMeshData.js.

The MakeHuman base mesh, its targets, skeleton and weights are released under
CC0 1.0 (https://github.com/makehumancommunity/makehuman, LICENSE.md part C).
Nothing of MakeHuman's program is used, only that data.

    git clone --depth 1 https://github.com/makehumancommunity/makehuman
    python3 tools/extract_hand.py makehuman/makehuman/data

The hand is that of a young man of average build (the base mesh with the
caucasian-male-young and universal-male-young targets). It is written as it
stands in MakeHuman (metres, relative to the wrist joint); fitting it to the
game's hand joints is done in the game (src/actors/handMesh.js), so the game's
hand can change without running this again.
"""
import base64
import json
import os
import struct
import sys

data = sys.argv[1] if len(sys.argv) > 1 else 'makehuman/makehuman/data'
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'src', 'actors', 'handMeshData.js')

TARGETS = [
    ('targets/macrodetails/caucasian-male-young.target', 1.0),
    ('targets/macrodetails/universal-male-young-averagemuscle-averageweight.target', 1.0),
]
FINGERS = ['finger%d-%d.R' % (f, k) for f in range(1, 6) for k in range(1, 4)]
BONES = ['wrist.R', 'lowerarm02.R', 'metacarpal1.R', 'metacarpal2.R', 'metacarpal3.R', 'metacarpal4.R'] + FINGERS
HAND = set(BONES) - {'lowerarm02.R'}
STUB = 0.045  # metres of forearm kept above the wrist (inside the cuff)

# --- the mesh ---------------------------------------------------------------
V, F = [], []
group = ''
for line in open(os.path.join(data, '3dobjs/base.obj')):
    if line.startswith('v '):
        V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('g '):
        group = line.split()[1]
    elif line.startswith('f ') and group == 'body':
        F.append([int(p.split('/')[0]) - 1 for p in line.split()[1:]])
for path, w in TARGETS:
    for line in open(os.path.join(data, path)):
        p = line.split()
        if len(p) == 4 and not line.startswith('#'):
            i = int(p[0])
            for k in range(3):
                V[i][k] += w * float(p[k + 1])
V = [[c * 0.1 for c in v] for v in V]  # decimetres to metres

# --- bones and weights ------------------------------------------------------
sk = json.load(open(os.path.join(data, 'rigs/default.mhskel')))
wt = json.load(open(os.path.join(data, 'rigs/default_weights.mhw')))['weights']


def joint(name):
    idx = sk['joints'][name]
    return [sum(V[i][k] for i in idx) / len(idx) for k in range(3)]


heads = {b: joint(sk['bones'][b]['head']) for b in BONES}
tails = {b: joint(sk['bones'][b]['tail']) for b in BONES}
wrist = heads['wrist.R']
per = {}  # vertex -> {bone: weight}
for bone, pairs in wt.items():
    for i, w in pairs:
        per.setdefault(i, {})[bone] = per.get(i, {}).get(bone, 0) + w

# Everything not of the hand counts as forearm.
def classes(i):
    o = {}
    for bone, w in per.get(i, {}).items():
        b = bone if bone in HAND else 'lowerarm02.R'
        o[b] = o.get(b, 0) + w
    return o


def hand_weight(i):
    return sum(w for b, w in classes(i).items() if b in HAND)


# Faces of the hand, and up the forearm as far as the stub goes.
fa = [tails['lowerarm02.R'][k] - heads['lowerarm02.R'][k] for k in range(3)]
fl = sum(c * c for c in fa) ** 0.5
fa = [c / fl for c in fa]


def above(i):  # metres above the wrist joint, along the forearm
    return -sum((V[i][k] - wrist[k]) * fa[k] for k in range(3))


def near(i):
    return sum((V[i][k] - wrist[k]) ** 2 for k in range(3)) ** 0.5 < 0.3


faces = [f for f in F if all(near(i) for i in f) and all(hand_weight(i) > 0.02 or above(i) < STUB for i in f) and all(above(i) < STUB + 0.02 for i in f)]
used = sorted({i for f in faces for i in f})
remap = {i: n for n, i in enumerate(used)}
tris = []
for f in faces:
    q = [remap[i] for i in f]
    if len(q) == 3:
        tris.append(q)
    else:
        d = lambda a, b: sum((V[used[q[a]]][k] - V[used[q[b]]][k]) ** 2 for k in range(3))
        tris += [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] if d(0, 2) <= d(1, 3) else [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]

# --- written out --------------------------------------------------------------
Q = 20000  # steps a metre (0.05 mm)
pos = b''.join(struct.pack('<3h', *[round((V[i][k] - wrist[k]) * Q) for k in range(3)]) for i in used)
idx = b''.join(struct.pack('<3H', *t) for t in tris)
skin = b''
for i in used:
    c = sorted(classes(i).items(), key=lambda x: -x[1])[:4]
    total = sum(w for _, w in c) or 1
    c = [(BONES.index(b), round(255 * w / total)) for b, w in c] + [(0, 0)] * 4
    skin += struct.pack('<8B', *[x for pair in c[:4] for x in pair])
bones = [[b] + [round(heads[b][k] - wrist[k], 5) for k in range(3)] + [round(tails[b][k] - wrist[k], 5) for k in range(3)] for b in BONES]
b64 = lambda b: base64.b64encode(b).decode()
with open(out, 'w') as f:
    f.write('// A right hand, cut from the MakeHuman base mesh (CC0 1.0: github.com/makehumancommunity/makehuman)\n')
    f.write('// by tools/extract_hand.py. Not written by hand: run the tool to change it.\n')
    f.write('// As it stands in MakeHuman (the wrist joint at 0): fitted to the game\'s hand in handMesh.js.\n')
    f.write('export const HAND_DATA = {\n')
    f.write('  steps: %d, // positions: this many steps a metre, int16 x, y, z\n' % Q)
    f.write('  vertices: %d,\n  triangles: %d,\n' % (len(used), len(tris)))
    f.write('  // [bone, head x, y, z, tail x, y, z] in metres\n  bones: %s,\n' % json.dumps(bones))
    f.write("  positions: '%s',\n" % b64(pos))
    f.write("  // a vertex's four [bone, weight / 255]\n  skin: '%s',\n" % b64(skin))
    f.write("  // uint16 corners of the triangles\n  index: '%s',\n" % b64(idx))
    f.write('};\n')
print('hand: %d vertices, %d triangles -> %s (%d KB)' % (len(used), len(tris), out, os.path.getsize(out) // 1024))
