"""Pull the original game's weapon upgrades, ammunition and prices out of the
fan-kept data files and write them as src/weapons/upgradeData.js.

    python3 -I tools/extract_upgrades.py <path to hagcp-assets/json>

The data is the Heroes & Generals community project's dump
(github.com/raouldeheer/heroes-and-generals-community-project,
packages/hagcp-assets/json). Tables used:
  WeaponModifierTemplate  the upgrades and what each multiplies
  WeaponModMapping        which gun takes which upgrade
  ammotemplate, weaponAmmoMapping   the ammunition each gun can load
  Pricing                 credit prices (upgrades, ammunition, guns, items)

The dump holds 98 upgrades. Where it lists one name twice on one gun (an older
entry beside the full set of reticles), the later entry is kept. Upgrades and
ammunition with no price in the dump take the price of the same name on
another gun, else the middle price of the gun's other choices of that kind.
"""
import json
import os
import statistics
import sys

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'weapons', 'upgradeData.js')


def load(name):
    with open(os.path.join(SRC, name + '.json')) as f:
        return json.load(f)


# The data's gun (weapontemplate id) -> our weapon ids.
GUNS = {
    '40': ['m1_garand'], '16': ['m1_carbine'], '56': ['m1a1_carbine'], '50': ['m2_carbine'], '46': ['m1903'],
    '32': ['thompson_m1a1'], '5': ['m3_greasegun'], '45': ['bar_m1918a2'], '62': ['m1919a6'], '66': ['johnson_lmg'],
    '20': ['m1911a1'], '8': ['m1917_revolver'], '76': ['colt_1903'],
    '43': ['kar98k'], '44': ['gewehr43'], '31': ['mp40'], '6': ['mp34'], '49': ['stg44'], '61': ['mg42'],
    '63': ['mg34'], '47': ['fg42'], '67': ['p38'], '7': ['luger_p08'], '21': ['c96'], '77': ['beretta_1934'],
    '12': ['mosin_9130'], '14': ['svt40'], '54': ['avs36'], '33': ['ppsh41'], '57': ['pps43'], '24': ['ppd40'],
    '9': ['dp28'], '22': ['tt33'], '58': ['nagant_m1895'], '34': ['ptrd41'], '90': ['korovin_tk'],
    # The original's three scoped rifles: their scope is fixed; the other upgrades are theirs.
    '42': ['m1903a4', 'm1903a1_unertl'], '41': ['kar98k_zf39', 'kar98k_zf41'], '13': ['mosin_pu', 'mosin_pem'],
}

# Items priced in the data (weapontemplate id -> our id). Guns come from GUNS.
ITEMS = {
    '52': 'bazooka_m1a1', '53': 'panzerschreck', '51': 'panzerfaust60', '10': 'mk2_grenade',
    '11': 'stielhandgranate24', '15': 'rgd33', '3': 'spade_m1910', '4': 'spade_ge', '25': 'spade_mpl50',
    '1': 'knife_m3', '2': 'bayonet_s84_98', '23': 'knife_nr40', '55': 'bayonet_avs36', '149': 'bat_us',
    '150': 'bat_ge', '151': 'bat_lapta', '99': 'binoc_us', '98': 'binoc_ge', '48': 'binoc_su',
    '75': 'firstaid_us', '73': 'firstaid_ge', '74': 'firstaid_su', '78': 'medic_us', '89': 'medic_ge',
    '79': 'medic_su', '102': 'wrench',
}

SLOTS = {1: 'ammo', 2: 'barrel', 3: 'internal', 4: 'sight', 5: 'trigger'}
FIELDS = {
    'fRangeNear': 'rangeNear', 'fRangeFar': 'rangeFar', 'fDamage': 'damage', 'fDamageFar': 'damageFar',
    'fCameraRecoilRight': 'recoilRight', 'fCameraRecoilUp': 'recoilUp', 'fCameraRecoilVariance': 'recoilVariance',
    'fRecoilTime': 'recoilTime', 'fChamberTime': 'chamberTime', 'fConeStandMode': 'coneStand',
    'fConeCrouchMode': 'coneCrouch', 'fConeProneMode': 'coneProne', 'fConeAimModifier': 'coneAim',
    'fConeContractionPerSecond': 'coneSettle',
}
FAMILIES = {'M84': 'm84', 'M73B1': 'm73b1', 'Unertl 8X': 'unertl', 'ZF-39': 'zf39', 'ZF-4': 'zf4', 'ZF-41': 'zf41',
            'ZS Zielacht': 'zielacht', 'PU': 'pu', 'PE': 'pe'}
RETICLES = {'Fine Cross': 'crosshair', 'Fine Duplex': 'fineDuplex', 'German#1': 'german1', 'German#4': 'german4',
            'T-Post': 'tPost', 'Infantry': 'infantry', 'Infantry Marksman': 'infantryMarksman'}

wt = {w['id']: w for w in load('weapontemplate')}
mods = {m['id']: m for m in load('WeaponModifierTemplate')}
cats = {c['id']: c for c in load('WeaponModCategory')}
ammo = {a['id']: a for a in load('ammotemplate')}
price = {}
for p in load('Pricing'):
    price.setdefault(p['type'], {})[p['objectId']] = p['costCredits']


def r(x, n=3):
    return round(x, n)


def name_of(m):
    n = m['name']
    return n.split('] ', 1)[1] if n.startswith('[') else n


upgrades, ammo_types, guns = {}, {}, {}
mod_price = price['WeaponModifierTemplate']
by_name = {}
for i, m in mods.items():
    if i in mod_price:
        by_name.setdefault(name_of(m), []).append(mod_price[i])

for i, m in sorted(mods.items(), key=lambda kv: int(kv[0])):
    slot = SLOTS[cats[str(m['weaponModCategoryId'])]['weaponModSlotId']]
    n = name_of(m)
    u = {'name': n, 'slot': slot}
    f = {v: r(m[k]) for k, v in FIELDS.items() if abs(m[k] - 1) > 1e-6}
    if f:
        u['f'] = f
    if m['sightMagnification'] > 1:
        fam, ret = n.split(' (')
        u['family'] = FAMILIES[fam]
        u['reticle'] = RETICLES[ret.rstrip(')')]
        u['mag'] = r(m['sightMagnification'], 2)
        u['drum'] = [m['sightDistMin'], m['sightDistMax'], m['sightDistIncrement']]
    u['credits'] = mod_price.get(i)
    if u['credits'] is None and by_name.get(n):
        u['credits'] = int(statistics.median(by_name[n]))
    upgrades['u' + i] = u

ammo_price = price['ammotemplate']
for i, a in ammo.items():
    cal, _, n = a['name'].partition('] ')
    ammo_types['a' + i] = {
        'name': n.strip(), 'cartridge': cal.lstrip('['), 'damage': a['damage'], 'damageFar': a['damagefar'],
        'rangeNear': a['rangenear'], 'rangeFar': a['rangefar'], 'speed': a['speed'],
        'cone': r(a['coneModifier']), 'recoil': r(a['recoilModifier']), 'credits': ammo_price.get(i),
    }

mod_map, ammo_map = {}, {}
for x in load('WeaponModMapping'):
    mod_map.setdefault(x['weaponTemplateId'], []).append(x['weaponModifierTemplateId'])
for x in load('weaponAmmoMapping'):
    ammo_map.setdefault(x['weaponTemplateId'], []).append((x['ammoTemplateId'], x['defaultAmmo']))

used_ammo = set()
for w, ours in GUNS.items():
    # One entry per name on a gun: the later one.
    seen = {}
    for i in sorted(mod_map.get(w, []), key=int):
        seen[(upgrades['u' + i]['slot'], upgrades['u' + i]['name'])] = 'u' + i
    ups = sorted(seen.values(), key=lambda k: int(k[1:]))
    rounds, default, names = [], None, {}
    for i, d in sorted(ammo_map.get(w, []), key=lambda t: int(t[0])):
        a = ammo_types['a' + i]
        if d:
            default = 'a' + i
        elif a['name'] not in names:
            names[a['name']] = 'a' + i
    rounds = sorted(names.values(), key=lambda k: int(k[1:]))
    used_ammo.update(rounds + [default])
    for kind, ids in (('u', ups), ('a', rounds)):
        table = upgrades if kind == 'u' else ammo_types
        known = [table[k]['credits'] for k in ids if table[k]['credits']]
        for k in ids:
            if not table[k]['credits']:
                table[k]['credits'] = int(statistics.median(known)) if known else 10000
    for o in ours:
        guns[o] = {'upgrades': ups, 'ammo': default, 'rounds': rounds}

used_up = {k for g in guns.values() for k in g['upgrades']}
gun_prices = {}
for w, ours in GUNS.items():
    for o in ours:
        gun_prices[o] = price['weapontemplate'].get(w, 0)
for w, o in ITEMS.items():
    gun_prices[o] = price['weapontemplate'].get(w, 0)


def js(obj):
    return json.dumps(obj, separators=(',', ':'), ensure_ascii=False)


with open(OUT, 'w') as f:
    f.write('// The original game\'s weapon upgrades, ammunition and credit prices.\n')
    f.write('// Written by tools/extract_upgrades.py from the original data; do not edit\n')
    f.write('// by hand. See src/weapons/upgrades.js for what the numbers mean.\n\n')
    f.write('// Upgrades by id (the data\'s, with u in front).\n')
    f.write('export const UPGRADES = {\n')
    for k in sorted(used_up, key=lambda k: int(k[1:])):
        f.write(f'  {k}: {js(upgrades[k])},\n')
    f.write('};\n\n// Ammunition by id (the data\'s, with a in front).\nexport const AMMO_TYPES = {\n')
    for k in sorted(used_ammo, key=lambda k: int(k[1:])):
        f.write(f'  {k}: {js(ammo_types[k])},\n')
    f.write('};\n\n// Each gun\'s upgrades, its standard ammunition and the other rounds it takes.\n')
    f.write('export const GUN_UPGRADES = {\n')
    for k, v in guns.items():
        f.write(f'  {k}: {js(v)},\n')
    f.write('};\n\n// Credit prices of guns and items (weapontemplate), by our id.\nexport const PRICES = {\n')
    for k, v in gun_prices.items():
        f.write(f'  {k}: {v},\n')
    f.write('};\n')
print('wrote', OUT, len(used_up), 'upgrades', len(used_ammo), 'rounds', len(guns), 'guns')
