"""Pull the original game's war map and assault teams out of the fan-kept
data files and write them as src/war/warMapData.js.

    python3 -I tools/extract_warmap.py <path to hagcp-assets/json>

The data is the Heroes & Generals community project's dump
(github.com/raouldeheer/heroes-and-generals-community-project,
packages/hagcp-assets/json, MIT licence, (c) 2022 Raoul de Heer). Tables used:
  battlefield        the map points: name, position, kind (by its battle map)
  accesspoint, supplyline   the supply lines between the points
  capital            the 23 capitals and who holds each at the start
  commandnodetemplate, commandnodetemplatearmyresourcetemplaterelation
                     the assault teams: speed, command points, level, what
                     each upgrades from, what it is made of
  armyresourcecategory, ArmyResourceProductionTemplate
                     what an army produces every ten minutes, and its stock
  CommandNodeMoraleTemplate, AssaultTeamLevel, WarBonusTemplate

Only the one big connected network is kept (4,248 of the 4,290 points); the
rest are test points and a few strays. Positions are the data's map units
(about 0 to 16,400 across, 0 to 11,000 down; Leningrad is at the top).
"""
import json
import os
import sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'war', 'warMapData.js')


def load(name):
    with open(os.path.join(SRC, name + '.json')) as f:
        return json.load(f)


gamemaps = {g['id']: g['gamemapname'] for g in load('gamemap')}
KIND = {'Town': 't', 'Mountain Town': 'm', 'Factory': 'f', 'Airfield': 'a', 'Forward Airfield': 'w'}
bf = {b['id']: b for b in load('battlefield')}
ap = {a['id']: a['battlefield'] for a in load('accesspoint')}

adj = {}
for s in load('supplyline'):
    a, b = ap[s['accesspoint1Id']], ap[s['accesspoint2Id']]
    if a == b:
        continue
    adj.setdefault(a, set()).add(b)
    adj.setdefault(b, set()).add(a)

# The biggest connected network.
seen, best = set(), []
for k in adj:
    if k in seen:
        continue
    stack, comp = [k], []
    seen.add(k)
    while stack:
        u = stack.pop()
        comp.append(u)
        for v in adj[u]:
            if v not in seen:
                seen.add(v)
                stack.append(v)
    if len(comp) > len(best):
        best = comp
keep = sorted(best, key=lambda k: (bf[k]['posy'], bf[k]['posx']))
index = {k: i for i, k in enumerate(keep)}

names, xy, kinds = [], [], []
for k in keep:
    b = bf[k]
    names.append(b['bftitle'].strip())
    xy += [round(b['posx']), round(b['posy'])]
    kinds.append(KIND.get(gamemaps.get(b['gamemap']), 't'))
lines = []
for a in keep:
    for b in adj[a]:
        if index[a] < index[b]:
            lines += [index[a], index[b]]

FACTION = {'0': '', '1': 'US', '2': 'GE', '3': 'SU'}
capitals = sorted(([index[c['battlefieldId']], FACTION[c['defaultFactionTemplateId']]] for c in load('capital') if c['battlefieldId'] in index), key=lambda c: c[0])

# Assault teams (the US set; the three armies' trees are the same).
cats = {c['id']: c for c in load('armyresourcecategory')}
nodes = {n['id']: n for n in load('commandnodetemplate') if n['factionTemplateId'] == '1'}
made = {}
for r in load('commandnodetemplatearmyresourcetemplaterelation'):
    if r['commandnodetemplateid'] in nodes:
        made.setdefault(r['commandnodetemplateid'], []).append([cats[r['armyresourcecategoryid']]['name'], r['count'], r['vehicleSpawnSlots']])
teams = {}
for i, n in nodes.items():
    if n['name'] in ('hq', 'commander', 'reserve'):
        continue
    parent = nodes.get(n['parenttemplateid'])
    convert = nodes.get(n['convertTo'])
    teams[n['name']] = {
        'speed': round(n['speed'], 3),
        'cp': n['size'],
        'level': n['level'],
        'from': parent['name'] if parent else None,
        'becomes': convert['name'] if convert else None,
        'view': n['viewRange'],
        'attackRadius': n['attackradius'],
        'transportRadius': n['transportradius'],
        'winFunds': n['victoryWarfundBonus'],
        'joinFunds': n['participationWarfundBonus'],
        'owner': {'1': 'infantry', '2': 'pilot', '4': 'paratrooper', '5': 'tanker', '6': 'recon'}.get(n['generalCharacterTemplateId']),
        'made': sorted(made.get(i, []), key=lambda m: m[0] != 'infantryman'),
    }

production = {}
for p in load('ArmyResourceProductionTemplate'):
    if p['factionTemplateId'] == '1' and p['armyResourceCategoryId'] in cats:
        c = cats[p['armyResourceCategoryId']]
        production[c['name']] = {'every': int(p['runEveryTimeInSeconds']), 'make': p['produceEveryRun'], 'start': p['warStartValue'], 'size': c['avgSize']}

morale = load('CommandNodeMoraleTemplate')[0]
levels = [l['xp'] for l in sorted(load('AssaultTeamLevel'), key=lambda l: l['level'])]
bonus = load('WarBonusTemplate')[0]

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w') as f:
    f.write('// The original game\'s war map and assault teams, from the fan-kept data dump\n')
    f.write('// (Heroes & Generals community project, MIT licence, (c) 2022 Raoul de Heer).\n')
    f.write('// Written by tools/extract_warmap.py: do not edit by hand.\n')
    f.write('//\n')
    f.write('//   POINT_NAMES  the points\' names, one per line\n')
    f.write('//   POINT_XY     x, y of each point in map units (y grows southward)\n')
    f.write('//   POINT_KINDS  one letter each: t town, m mountain town, f factory, a airfield, w forward airfield\n')
    f.write('//   LINES        the supply lines, as pairs of point numbers\n')
    f.write('//   CAPITALS     [point, army holding it at the start (\'\' for neutral)]\n')
    f.write('//   TEAM_DATA    the assault teams; PRODUCTION, MORALE, TEAM_LEVELS, WAR_BONUS\n')
    f.write('export const POINT_NAMES = ' + json.dumps('\n'.join(names), ensure_ascii=False) + ';\n')
    f.write('export const POINT_XY = ' + json.dumps(xy, separators=(',', ':')) + ';\n')
    f.write('export const POINT_KINDS = ' + json.dumps(''.join(kinds)) + ';\n')
    f.write('export const LINES = ' + json.dumps(lines, separators=(',', ':')) + ';\n')
    f.write('export const CAPITALS = ' + json.dumps(capitals, separators=(',', ':')) + ';\n')
    f.write('export const TEAM_DATA = ' + json.dumps(teams, indent=1) + ';\n')
    f.write('export const PRODUCTION = ' + json.dumps(production, indent=1) + ';\n')
    f.write('export const MORALE = ' + json.dumps({k: round(v, 3) if isinstance(v, float) else v for k, v in morale.items() if k != 'id'}) + ';\n')
    f.write('export const TEAM_LEVELS = ' + json.dumps(levels) + ';\n')
    f.write('export const WAR_BONUS = ' + json.dumps({'warfunds': bonus['warfundBonus'], 'xpPercent': bonus['xpBonusPercent']}) + ';\n')
print(len(names), 'points', len(lines) // 2, 'lines', len(capitals), 'capitals', len(teams), 'teams')
