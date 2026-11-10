"""Reading MakeHuman's data (for tools/extract_hand.py and extract_head.py).

The base mesh, targets, skeleton, weights, skins and proxies are MakeHuman
assets, released under CC0 1.0 (github.com/makehumancommunity/makehuman,
LICENSE.md part C). Nothing of MakeHuman's program is used.
"""
import json
import os


class Base:
    """The base mesh in metres: V vertices, F faces of the body as lists of
    (vertex, uv) pairs, VT uv coordinates, G vertices of each helper group."""

    def __init__(self, data):
        self.data = data
        self.V, self.VT, self.F, self.G = [], [], [], {}
        group = ''
        for line in open(os.path.join(data, '3dobjs/base.obj')):
            if line.startswith('v '):
                self.V.append([float(x) * 0.1 for x in line.split()[1:4]])
            elif line.startswith('vt '):
                self.VT.append([float(x) for x in line.split()[1:3]])
            elif line.startswith('g '):
                group = line.split()[1]
            elif line.startswith('f '):
                corners = [tuple(int(x) - 1 if x else -1 for x in (p.split('/') + [''])[:2]) for p in line.split()[1:]]
                if group == 'body':
                    self.F.append(corners)
                else:
                    self.G.setdefault(group, set()).update(c[0] for c in corners)
        self.skel = json.load(open(os.path.join(data, 'rigs/default.mhskel')))
        self.weights = {}  # vertex -> {bone: weight}
        for bone, pairs in json.load(open(os.path.join(data, 'rigs/default_weights.mhw')))['weights'].items():
            for i, w in pairs:
                d = self.weights.setdefault(i, {})
                d[bone] = d.get(bone, 0) + w

    def target(self, path):
        """A target's offsets in metres: {vertex: [dx, dy, dz]}."""
        out = {}
        for line in open(os.path.join(self.data, path)):
            p = line.split()
            if len(p) == 4 and p[0].isdigit():
                out[int(p[0])] = [float(x) * 0.1 for x in p[1:]]
        return out

    def apply(self, offsets, w=1.0):
        for i, d in offsets.items():
            for k in range(3):
                self.V[i][k] += w * d[k]

    def joint(self, name):
        idx = self.skel['joints'][name]
        return [sum(self.V[i][k] for i in idx) / len(idx) for k in range(3)]

    def bone(self, name):
        b = self.skel['bones'][name]
        return self.joint(b['head']), self.joint(b['tail'])

    def subtree(self, name):
        """A bone and every bone under it."""
        kids = {}
        for n, b in self.skel['bones'].items():
            kids.setdefault(b['parent'], []).append(n)
        out, todo = [], [name]
        while todo:
            n = todo.pop()
            out.append(n)
            todo += kids.get(n, [])
        return out


def triangles(quads, V):
    """Quads split along their shorter diagonal."""
    out = []
    for q in quads:
        if len(q) == 3:
            out.append(list(q))
            continue
        d = lambda a, b: sum((V[q[a]][k] - V[q[b]][k]) ** 2 for k in range(3))
        out += [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] if d(0, 2) <= d(1, 3) else [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]
    return out
