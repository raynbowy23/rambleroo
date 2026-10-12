# Build writer material for roads: catalog facts, state chapter blurbs with their sourced facts, and strip-map places.
# Usage (repo root): python3 scripts/stories/material.py <work dir> <id> [<id> ...]   Writes <work dir>/material/<id>.json.
import json, glob, os, sys
S, ids = sys.argv[1], sys.argv[2:]
os.makedirs(f'{S}/material', exist_ok=True)
cat = {b['id']: b for b in json.load(open('public/data/catalog.json'))['byways']}
chapters = {}
for f in sorted(glob.glob('content/states/*.json')):
    code = os.path.basename(f)[:-5]
    ch = json.load(open(f))
    src_path = f'content/states/sources/{code}.json'
    src = json.load(open(src_path)) if os.path.exists(src_path) else {}
    facts = {b['name']: b for b in src.get('byways', [])}
    for p in ch['programs']:
        for m in p['members']:
            if not m.get('bywayId'): continue
            s = facts.get(m['name'], {})
            chapters.setdefault(m['bywayId'], []).append({
                'state': code, 'program': p['label'], 'name': m['name'], 'url': m.get('url'), 'blurb': m.get('blurb'),
                'where': s.get('where'), 'designation': s.get('designation'), 'facts': s.get('facts', []),
            })
for i in ids:
    b = cat[i]
    strip = f'public/data/strips/{i}.json'
    places = []
    if os.path.exists(strip):
        for t in json.load(open(strip)).get('towns', []):
            places.append({'name': t['name'], 'kind': 'town', 'source': t.get('source'), 'at': t.get('at'), 'mile': t.get('mile')})
    d = {'id': i, 'name': b['name'], 'states': b['states'], 'designations': b['designations'], 'mappedMiles': b['mappedMiles'],
         'scene': b['scene'], 'center': b['center'], 'chapters': chapters.get(i, []), 'stripPlaces': places}
    json.dump(d, open(f'{S}/material/{i}.json', 'w'), indent=1, ensure_ascii=False)
print(len(ids), 'material files in', S + '/material')
