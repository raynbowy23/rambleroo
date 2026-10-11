# Install stories written to scripts/stories/CODEX_BRIEF.md (STYLE.md voice, evidence for every claim) into content/stories.
# Run from the repo root after verify.py passes for each work dir:
#   python3 scripts/stories/install_v2.py <work dir> [<work dir> ...]
# The public story keeps only reader-facing fields. Evidence quotes and editorial flags go to content/story-notes/<id>.json, which the
# app never loads, so a later correction can be checked against the quote that backed the original claim. A moment's practical note
# becomes a line in the story's "Before you go" list. A photo tied to a moment the new story dropped keeps its road but loses the moment.
import json, os, subprocess, sys

MOTIFS = set('river-bluffs lake-wide lock-and-dam paddlewheeler sandbars steeple-town harbor-village lighthouse limestone-ledges orchard rolling-ridges gristmill viaduct rhododendron-bald snow-peaks switchbacks mining-town aspens hoodoos slickrock-ridge arch-bridge sea-rock waterfall-cove'.split())
KINDS = {'roadside', 'short walk', 'separate excursion', 'town'}
SCENES = {'river', 'coast', 'mountain', 'forest', 'desert', 'town', 'prairie'}
HERE = os.path.dirname(os.path.abspath(__file__))
cat = {b['id']: b for b in json.load(open('public/data/catalog.json'))['byways']}
photos = json.load(open('content/photos.json'))
photos_changed = False
os.makedirs('content/story-notes', exist_ok=True)
installed = []
for W in sys.argv[1:]:
    if subprocess.run([sys.executable, f'{HERE}/verify.py', W], capture_output=True).returncode:
        sys.exit(f'{W}: verify.py reports problems; fix them first')
    for f in sorted(os.listdir(f'{W}/out')):
        if not f.endswith('.json'):
            continue
        d = json.load(open(f'{W}/out/{f}'))
        i = d['id']
        if i not in cat:
            print('SKIP unknown id', i)
            continue
        url = {}
        for e in d['evidence']:
            if e['file'] not in url:
                url[e['file']] = open(f'{W}/{e["file"]}').readline().removeprefix('URL:').strip()
        practical, moments = [], []
        for m in d['moments']:
            keep = {'title': m['title'], 'kind': m['kind'] if m.get('kind') in KINDS else 'roadside', 'scene': m['scene'] if m.get('scene') in SCENES else cat[i]['scene'], 'text': m['text']}
            if m.get('notice'): keep['notice'] = m['notice']
            if isinstance(m.get('at'), list) and len(m['at']) == 2: keep['at'] = m['at']
            motifs = [x for x in m.get('motifs') or [] if x in MOTIFS]
            if motifs: keep['motifs'] = motifs
            if m.get('practical'):
                practical.append(f'{m["title"]}: {m["practical"]["text"]} (checked {m["practical"]["checked"]})')
            moments.append(keep)
        story = {'id': i, 'tagline': d['tagline'], 'motifs': [x for x in d.get('motifs') or [] if x in MOTIFS], 'intro': d['intro'], 'notice': d.get('notice'), 'moments': moments, 'practical': practical, 'sources': d['sources'], 'reviewed': False}
        story = {k: v for k, v in story.items() if v not in (None, '', [])} | {'reviewed': False}
        open(f'content/stories/{i}.json', 'w').write(json.dumps(story, indent=2, ensure_ascii=False) + '\n')
        notes = {'id': i, 'style': 'scripts/stories/STYLE.md', 'evidence': [{'claim': e['claim'], 'source': url[e['file']], 'quote': e['quote']} for e in d['evidence']], 'flags': d.get('flags', [])}
        open(f'content/story-notes/{i}.json', 'w').write(json.dumps(notes, indent=1, ensure_ascii=False) + '\n')
        titles = {m['title'] for m in moments}
        for p in photos:
            if p['bywayId'] == i and p.get('moment') and p['moment'] not in titles:
                print(f'  {i}: photo {p["file"]} was tied to dropped moment {p["moment"]!r}; it stays a road photo')
                del p['moment']
                photos_changed = True
        installed.append(i)
if photos_changed:
    open('content/photos.json', 'w').write(json.dumps(photos, indent=2, ensure_ascii=False) + '\n')
    print('content/photos.json changed: run npx tsx scripts/photos/split.ts')
print('installed', len(installed))
