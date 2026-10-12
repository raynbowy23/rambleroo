# Copy checked stories into content/stories after mechanical checks. Run from the repo root:
#   python3 scripts/stories/install.py <work dir> [<batch file> ...]
# Name the batch files whose checkers have finished; a checker still running may have half-written files in checked/.
import json, glob, os, re, sys
S = sys.argv[1]
only = {l.strip() for f in sys.argv[2:] for l in open(f) if l.strip()}
MOTIFS = set('river-bluffs lake-wide lock-and-dam paddlewheeler sandbars steeple-town harbor-village lighthouse limestone-ledges orchard rolling-ridges gristmill viaduct rhododendron-bald snow-peaks switchbacks mining-town aspens hoodoos slickrock-ridge arch-bridge sea-rock waterfall-cove'.split())
KINDS = {'roadside', 'short walk', 'separate excursion', 'town'}
SCENES = {'river', 'coast', 'mountain', 'forest', 'desert', 'town', 'prairie'}
BAN = re.compile(r'breathtaking|stunning|must-see|hidden gem|spectacular|iconic|nestled|boasts|offers visitors|rich history|honest|!|\?|—', re.I)
cat = {b['id']: b for b in json.load(open('public/data/catalog.json'))['byways']}
ok = bad = 0
for f in sorted(glob.glob(f'{S}/checked/*.json')):
    d = json.load(open(f)); i = d.get('id'); errs = []
    if only and i not in only: continue
    if i not in cat: errs.append('unknown id')
    if os.path.exists(f'content/stories/{i}.json') and json.load(open(f'content/stories/{i}.json')).get('reviewed'): errs.append('reviewed story exists')
    d['motifs'] = [m for m in d.get('motifs', []) if m in MOTIFS]
    if not d.get('tagline') or len(d.get('intro', [])) < 1: errs.append('missing text')
    if not 2 <= len(d.get('moments', [])) <= 3: errs.append('moments count')
    for m in d.get('moments', []):
        if m.get('kind') not in KINDS: m['kind'] = 'roadside'
        if m.get('scene') not in SCENES: m['scene'] = cat.get(i, {}).get('scene', 'town')
        m['motifs'] = [x for x in m.get('motifs', []) if x in MOTIFS] or None
        if m['motifs'] is None: m.pop('motifs')
        at = m.get('at')
        if at is not None:
            b = cat.get(i, {}).get('bbox')
            if not (isinstance(at, list) and len(at) == 2 and b and b[0] - 1 <= at[0] <= b[2] + 1 and b[1] - 1 <= at[1] <= b[3] + 1):
                m.pop('at'); print('  dropped far/invalid coordinates', i, m['title'])
    text = ' '.join([d.get('tagline', ''), *d.get('intro', []), d.get('season', ''), *d.get('practical', []), *[m.get('text', '') for m in d.get('moments', [])]])
    if BAN.search(text): errs.append(f'style: {BAN.search(text).group(0)}')
    if not d.get('sources') or not all(str(s.get('url', '')).startswith('https://') for s in d['sources']): errs.append('sources')
    d['reviewed'] = False
    if errs:
        bad += 1; print('SKIP', i, errs); continue
    order = ['id', 'tagline', 'motifs', 'intro', 'season', 'moments', 'practical', 'sources', 'reviewed']
    d = {k: d[k] for k in order if k in d and d[k] not in ('', [], None)} | {'reviewed': False}
    open(f'content/stories/{i}.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n'); ok += 1
print('installed', ok, 'skipped', bad)
