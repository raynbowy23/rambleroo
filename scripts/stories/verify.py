# Mechanical check of story drafts written to CODEX_BRIEF.md: every evidence quote must appear in its cache file, lengths, banned words and
# punctuation, kept moment titles, and hedges (printed for the coordinator to compare with the source).
# Usage: python3 verify.py [<work dir>]   (default: the current directory, which holds out/, cache/ and current/)
import json, os, re, sys

W = sys.argv[1] if len(sys.argv) > 1 else '.'
BAN = re.compile(r'breathtaking|stunning|must-see|hidden gem|spectacular|iconic|nestled|boasts|rich history|rich tapestry|—|!|\?', re.I)
HEDGE = re.compile(r'\b(approximately|about|around|nearly|roughly|reportedly|according to|is said|said to|tradition|described as|believed|likely|probably|may have|perhaps)\b', re.I)


def norm(s):
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace('–', '-')
    return re.sub(r'\s+', ' ', s).strip().lower()


words = lambda t: len(t.split())
problems = 0
for f in sorted(os.listdir(f'{W}/out')):
    if not f.endswith('.json'):
        continue
    s = json.load(open(f'{W}/out/{f}'))
    rid = s['id']
    out = []
    intro = sum(words(p) for p in s['intro'])
    if not 8 <= words(s['tagline']) <= 16: out.append(f'LENGTH tagline {words(s["tagline"])} words')
    if intro > 320: out.append(f'LENGTH intro {intro} words')
    if not 3 <= len(s['moments']) <= 5: out.append(f'LENGTH {len(s["moments"])} moments')
    for m in s['moments']:
        if words(m['text']) > 165: out.append(f'LENGTH moment {m["title"]} {words(m["text"])} words')
    texts = [s['tagline'], *s['intro'], s.get('notice', '')] + [x for m in s['moments'] for x in (m['text'], m.get('notice', ''), (m.get('practical') or {}).get('text', ''))]
    for t in texts:
        b = BAN.search(t)
        if b: out.append(f'BANNED {b.group(0)!r}: {t[max(0, b.start() - 50):b.end() + 20]}')
    cache = {}
    for e in s['evidence']:
        path = f'{W}/{e["file"]}'
        if path not in cache: cache[path] = norm(open(path).read()) if os.path.exists(path) else ''
        if norm(e['quote']) not in cache[path]: out.append(f'MISSING quote in {e["file"]}: {e["quote"][:90]}')
    cited = {e['file'] for e in s['evidence']}
    urls = {open(f'{W}/{c}').readline().removeprefix('URL:').strip() for c in cited if os.path.exists(f'{W}/{c}')}
    listed = {x['url'] for x in s['sources']}
    for u in sorted(urls - listed): out.append(f'MISSING source entry for cited page {u}')
    cur = f'{W}/current/{rid}.json'
    if os.path.exists(cur):
        titles = {m['title'] for m in s['moments']}
        dropped = [m['title'] for m in json.load(open(cur))['moments'] if m['title'] not in titles]
        if dropped: print(f'{rid}: note, current moments not kept: {dropped}')
    hedges = [h.group(0) + ' <- ' + t[max(0, h.start() - 50):h.end() + 30] for t in texts for h in HEDGE.finditer(t)]
    print(f'== {rid}: tagline {words(s["tagline"])}, intro {intro}, moments {[words(m["text"]) for m in s["moments"]]}, evidence {len(s["evidence"])}, flags {len(s.get("flags", []))}')
    for h in hedges: print('   hedge:', h)
    for o in out: print('  ', o)
    problems += len(out)
print('problems:', problems)
sys.exit(1 if problems else 0)
